"""Resize the app EC2 instance between t3.nano (off-peak) and t3.medium (peak).

Invoked by two EventBridge Scheduler rules with payloads:
    {"instance_type": "t3.medium"}   # before peak
    {"instance_type": "t3.nano"}    # after peak

The instance keeps its Elastic IP across the stop/start, and PM2's
systemd resurrect brings the app back up on boot. Expect ~2-3 minutes
of downtime per switch.
"""
import os
import boto3

INSTANCE_ID = os.environ["INSTANCE_ID"]

ec2 = boto3.client("ec2")


def handler(event, context):
    target_type = event["instance_type"]

    instance = ec2.describe_instances(InstanceIds=[INSTANCE_ID])["Reservations"][0]["Instances"][0]
    current_type = instance["InstanceType"]
    state = instance["State"]["Name"]

    if current_type == target_type:
        print(f"Already {target_type}; nothing to do.")
        return {"changed": False, "type": current_type}

    print(f"Resizing {INSTANCE_ID}: {current_type} -> {target_type} (state: {state})")

    if state == "running":
        ec2.stop_instances(InstanceIds=[INSTANCE_ID])
        ec2.get_waiter("instance_stopped").wait(
            InstanceIds=[INSTANCE_ID],
            WaiterConfig={"Delay": 10, "MaxAttempts": 60},
        )

    ec2.modify_instance_attribute(
        InstanceId=INSTANCE_ID,
        InstanceType={"Value": target_type},
    )

    ec2.start_instances(InstanceIds=[INSTANCE_ID])
    ec2.get_waiter("instance_running").wait(
        InstanceIds=[INSTANCE_ID],
        WaiterConfig={"Delay": 10, "MaxAttempts": 60},
    )

    print(f"Done: {INSTANCE_ID} is now {target_type} and running.")
    return {"changed": True, "type": target_type}
