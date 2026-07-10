# Lightsail → EC2 migration with scheduled resizing

Target setup: one EC2 instance that runs as **t3.nano off-peak** and is
automatically resized to **t3.medium during peak hours** by a Lambda on an
EventBridge schedule. Each switch stops/starts the instance (~2–3 min
downtime); the Elastic IP and disk are preserved, and PM2 brings the app
back up on boot. Caddy fronts the app and handles HTTPS certificates
automatically.

Nothing on the app changes — state lives in Azure SQL and S3, so the server
is disposable.

---

## 1. Launch the EC2 instance

Console → EC2 → Launch instance:

- **AMI**: Ubuntu Server 24.04 LTS
- **Type**: `t3.nano` (start small; the schedule resizes it)
- **Key pair**: create/download one for SSH
- **Security group**: allow inbound `22` (your IP only), `80`, `443`
- **Storage**: 20 GB gp3
- **Region**: same as the Lightsail box (or closest to your users)

Then allocate an **Elastic IP** (EC2 → Elastic IPs → Allocate) and associate
it with the instance. This is critical: without an EIP the public IP changes
on every scheduled stop/start.

## 2. Bootstrap the server

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
curl -fsSL https://raw.githubusercontent.com/Teboho02/BethunanaAcademyVideos/main/deploy/ec2-setup.sh -o ec2-setup.sh
bash ec2-setup.sh
```

The script installs Node 22, PM2, Caddy, a 2GB swap file (needed for
on-server builds on a nano), clones and builds the app, configures Caddy as
a reverse proxy with automatic HTTPS, writes an `.env` template, and
registers PM2 with systemd so the app auto-starts after every resize.

Then:

```bash
nano /home/ubuntu/BethunanaAcademy/backend/.env   # real SQL password + S3 keys
pm2 restart BethunanaAcademy
pm2 logs BethunanaAcademy --lines 30 --nostream   # expect "SQL Server connection verified."
```

## 3. Azure SQL firewall

Azure portal → SQL server `bethunana` → **Networking** → add a firewall rule
for the Elastic IP. (Remove the old Lightsail IP rule once cut over.)

## 4. Point deploys and DNS at the new box

- GitHub repo → Settings → Secrets → update `SERVER_HOST` to the Elastic IP
  (and `SERVER_SSH_KEY` / `SERVER_USER=ubuntu` / `SERVER_PORT=22` if they differ).
- Update the DNS A records for `bethunanaacademy.co.za` (+ `www`) to the
  Elastic IP. Keep the Lightsail instance running until DNS has propagated
  and you've verified the site on the new IP.
- HTTPS is automatic: Caddy can't pass the Let's Encrypt challenge until DNS
  points at the instance, but it keeps retrying and issues the certificate
  by itself shortly after cutover — no action needed. To test the app by IP
  *before* cutover, uncomment the `:80` block in `/etc/caddy/Caddyfile` and
  `sudo systemctl reload caddy` (re-comment it after).

## 5. Set up the scheduled resize

Everything below is one-time setup with the AWS CLI. Set these first:

```bash
REGION=<your-region>                  # e.g. af-south-1
INSTANCE_ID=<i-xxxxxxxxxxxx>
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

### 5a. IAM role for the Lambda

```bash
aws iam create-role --role-name bethunana-resize-lambda \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam put-role-policy --role-name bethunana-resize-lambda \
  --policy-name resize-ec2 \
  --policy-document '{"Version":"2012-10-17","Statement":[
    {"Effect":"Allow","Action":["ec2:DescribeInstances"],"Resource":"*"},
    {"Effect":"Allow","Action":["ec2:StopInstances","ec2:StartInstances","ec2:ModifyInstanceAttribute"],
     "Resource":"arn:aws:ec2:*:*:instance/*"},
    {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"}]}'

aws iam attach-role-policy --role-name bethunana-resize-lambda \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 5b. The Lambda

```bash
cd deploy/resize
zip function.zip lambda_function.py

aws lambda create-function \
  --region $REGION \
  --function-name bethunana-resize \
  --runtime python3.12 \
  --handler lambda_function.handler \
  --timeout 600 \
  --zip-file fileb://function.zip \
  --environment "Variables={INSTANCE_ID=$INSTANCE_ID}" \
  --role arn:aws:iam::$ACCOUNT_ID:role/bethunana-resize-lambda
```

### 5c. The schedule (EventBridge Scheduler)

Peak window below is **14:00–21:00 Mon–Fri South Africa time** — adjust the
cron expressions to your real peak. Scheduler evaluates them in the timezone
given, so no UTC math needed.

```bash
aws iam create-role --role-name bethunana-scheduler \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam put-role-policy --role-name bethunana-scheduler \
  --policy-name invoke-resize \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\"}]}"

# Scale UP to t3.medium just before peak (13:50 SAST, Mon-Fri)
aws scheduler create-schedule --region $REGION \
  --name bethunana-scale-up \
  --schedule-expression "cron(50 13 ? * MON-FRI *)" \
  --schedule-expression-timezone "Africa/Johannesburg" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{\"Arn\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\",
             \"RoleArn\":\"arn:aws:iam::$ACCOUNT_ID:role/bethunana-scheduler\",
             \"Input\":\"{\\\"instance_type\\\": \\\"t3.medium\\\"}\"}"

# Scale DOWN to t3.nano after peak (21:10 SAST, Mon-Fri)
aws scheduler create-schedule --region $REGION \
  --name bethunana-scale-down \
  --schedule-expression "cron(10 21 ? * MON-FRI *)" \
  --schedule-expression-timezone "Africa/Johannesburg" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{\"Arn\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\",
             \"RoleArn\":\"arn:aws:iam::$ACCOUNT_ID:role/bethunana-scheduler\",
             \"Input\":\"{\\\"instance_type\\\": \\\"t3.nano\\\"}\"}"
```

### 5d. Test it

```bash
aws lambda invoke --region $REGION --function-name bethunana-resize \
  --payload '{"instance_type": "t3.medium"}' --cli-binary-format raw-in-base64-out /dev/stdout
# wait for it to finish, verify the site loads, then scale back:
aws lambda invoke --region $REGION --function-name bethunana-resize \
  --payload '{"instance_type": "t3.nano"}' --cli-binary-format raw-in-base64-out /dev/stdout
```

After each invoke, confirm the site comes back (PM2 resurrects on boot) and
`pm2 logs` shows `SQL Server connection verified.`

## 6. Decommission Lightsail

Once DNS points at the EIP, deploys succeed against the new host, and the
site has been stable for a few days: take a final Lightsail snapshot, then
delete the instance (and its static IP) to stop billing.

---

## Cost sketch (us-east-1 pricing, roughly)

| Item | Cost |
| --- | --- |
| t3.nano, ~133 h/week off-peak | ~$2.80/mo |
| t3.medium, ~35 h/week peak | ~$6.30/mo |
| Elastic IP (attached) + 20GB gp3 | ~$1.60/mo |
| Lambda + Scheduler | pennies |
| **Total** | **~$11/mo** |

Caveat: a stopped/started t3 loses its accrued CPU burst credits, so the
nano starts each off-peak window with baseline credits only. If you ever see
sluggishness right after scale-down, consider t3.micro as the floor instead.
