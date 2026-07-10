# EC2 deployment: setup & operations

The app runs on a single EC2 instance in **af-south-1** that is automatically
resized on a schedule by a Lambda + EventBridge Scheduler pair — smaller
instance overnight/off-peak, bigger one during peak hours. Each switch
stops/starts the instance (~2–3 min downtime); the Elastic IP and disk are
preserved, PM2 brings the app back up on boot, and Caddy fronts it with
automatic HTTPS.

Nothing stateful lives on the server — data is in Azure SQL, videos in
S3/CloudFront — so the instance is disposable and this document doubles as
the rebuild-from-scratch runbook.

## Live configuration

| Item | Value |
| --- | --- |
| Region | `af-south-1` |
| Instance | `i-0837b4ea02b53f94b` (+ Elastic IP) |
| App dir / process | `/home/ubuntu/BethunanaAcademy`, PM2 app `BethunanaAcademy` |
| Web server | Caddy (`/etc/caddy/Caddyfile`), auto-HTTPS |
| Resize Lambda | `bethunana-resize` |

Schedule (all times Africa/Johannesburg):

| Schedule name | Fires | Resizes to |
| --- | --- | --- |
| `bethunana-micro-daily` | every day 01:00 | `t3.micro` |
| `bethunana-small-weekday` | Mon–Fri 16:00 | `t3.small` |
| `bethunana-small-weekend` | Sat–Sun 09:00 | `t3.small` |

Net effect: weekdays run t3.micro 01:00→16:00 and t3.small 16:00→01:00;
weekends run t3.micro 01:00→09:00 and t3.small 09:00→01:00.

---

## Day-to-day operations

All CLI commands below run in **AWS CloudShell** (terminal icon in the AWS
console, region af-south-1). Two CloudShell gotchas learned the hard way:

- Run `export AWS_PAGER=""` first, or every command opens a pager (`q` exits it).
- Paste multi-line commands as **single lines** — line-wrapped JSON gets
  mangled and fails with `unexpected EOF while looking for matching '"'`.

Set these once per session:

```bash
export AWS_PAGER=""
REGION=af-south-1
INSTANCE_ID=i-0837b4ea02b53f94b
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

### Manually resize right now (e.g. exam-week override)

Console: **Lambda → bethunana-resize → Test tab** → run the saved
`scale-up` / `scale-down` test event (payload `{"instance_type": "t3.small"}`
or any other type). Takes ~2–3 minutes; response `{"changed": true, ...}`.

CLI equivalent:

```bash
aws lambda invoke --region $REGION --function-name bethunana-resize --payload '{"instance_type": "t3.small"}' --cli-binary-format raw-in-base64-out /dev/stdout
```

Note: a manual override lasts only until the next scheduled switch.

### Change the schedule times or sizes

Console: **EventBridge → Schedules** → pick the schedule → Edit (cron and the
JSON `Input` hold the time and target size). CLI: `aws scheduler update-schedule`
with the same arguments as the create commands below.

### Pause the automation (school holidays)

**EventBridge → Schedules** → select → **Disable** (re-enable later). The
instance then stays whatever size it currently is.

### Health checks & logs

- App up: `https://bethunanaacademy.co.za/api/health` → `{"success":true,...}`
- Resize history: CloudWatch → Log groups → `/aws/lambda/bethunana-resize`
- On the box: `pm2 list`, `pm2 logs BethunanaAcademy --lines 30 --nostream`
  (healthy start prints `SQL Server connection verified.`)
- After any resize, the first request can be slow: the instance boots, PM2
  resurrects the app, and the Azure SQL database may be waking from
  auto-pause (~30 s).

### Deploys

Push to `main` → GitHub Actions builds frontend + backend on the server and
restarts PM2. Server connection secrets: `SERVER_HOST` (the Elastic IP),
`SERVER_USER` (`ubuntu`), `SERVER_SSH_KEY`, `SERVER_PORT` (`22`).

---

## Rebuild from scratch

### 1. Launch the EC2 instance

Console → EC2 → Launch instance:

- **AMI**: Ubuntu Server 24.04 LTS
- **Type**: `t3.micro` (the schedule manages it from there)
- **Key pair**: create/download one for SSH
- **Security group**: allow inbound `22`, `80`, `443` (22 must be open to
  GitHub Actions runners for push-to-deploy, i.e. `0.0.0.0/0` unless you
  proxy deploys differently)
- **Storage**: 20 GB gp3
- **Region**: `af-south-1`

Then allocate an **Elastic IP** (EC2 → Elastic IPs) and associate it with the
instance. This is critical: without an EIP the public IP changes on every
scheduled stop/start.

### 2. Bootstrap the server

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
curl -fsSL https://raw.githubusercontent.com/Teboho02/BethunanaAcademyVideos/main/deploy/ec2-setup.sh -o ec2-setup.sh
bash ec2-setup.sh
```

The script installs Node 22, PM2, Caddy, a 2GB swap file (the small instance
sizes need it for on-server vite/tsc builds), clones and builds the app,
configures Caddy as a reverse proxy with automatic HTTPS, writes an `.env`
template, and registers PM2 with systemd so the app auto-starts after every
resize.

Then:

```bash
nano /home/ubuntu/BethunanaAcademy/backend/.env   # real SQL password + S3 keys
pm2 restart BethunanaAcademy
pm2 logs BethunanaAcademy --lines 30 --nostream   # expect "SQL Server connection verified."
```

### 3. Azure SQL firewall

Azure portal → SQL server `bethunana` → **Networking** → add a firewall rule
for the Elastic IP. Without it the backend times out connecting. (Database
is `BethunanaAcademyVideos` — the login only works against that DB.)

### 4. Point deploys and DNS at the new box

- GitHub repo → Settings → Secrets → update `SERVER_HOST` to the Elastic IP
  (and `SERVER_SSH_KEY` / `SERVER_USER` / `SERVER_PORT` if they differ).
- Update the DNS A records for `bethunanaacademy.co.za` (+ `www`) to the
  Elastic IP.
- HTTPS is automatic: Caddy can't pass the Let's Encrypt challenge until DNS
  points at the instance, but it keeps retrying and issues the certificate
  by itself shortly after cutover. To test the app by IP *before* cutover,
  uncomment the `:80` block in `/etc/caddy/Caddyfile` and
  `sudo systemctl reload caddy` (re-comment it after).

### 5. Recreate the scheduled resize

Run in CloudShell after setting the variables from the operations section.
All commands are deliberately on single lines (see CloudShell gotchas above).

#### 5a. IAM role the Lambda runs as

```bash
aws iam create-role --role-name bethunana-resize-lambda --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
```

```bash
aws iam put-role-policy --role-name bethunana-resize-lambda --policy-name resize-ec2 --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ec2:DescribeInstances"],"Resource":"*"},{"Effect":"Allow","Action":["ec2:StopInstances","ec2:StartInstances","ec2:ModifyInstanceAttribute"],"Resource":"arn:aws:ec2:*:*:instance/*"},{"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"}]}'
```

```bash
aws iam attach-role-policy --role-name bethunana-resize-lambda --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

#### 5b. The Lambda

CloudShell has no repo checkout, so fetch the function code from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/Teboho02/BethunanaAcademyVideos/main/deploy/resize/lambda_function.py -o lambda_function.py
zip function.zip lambda_function.py
sleep 10   # let the IAM role propagate
aws lambda create-function --region $REGION --function-name bethunana-resize --runtime python3.12 --handler lambda_function.handler --timeout 600 --zip-file fileb://function.zip --environment "Variables={INSTANCE_ID=$INSTANCE_ID}" --role arn:aws:iam::$ACCOUNT_ID:role/bethunana-resize-lambda
```

(`--timeout 600` because the function waits through the full stop → modify →
start cycle. The instance ID is an env var, so the schedules only carry the
target size.)

#### 5c. The three schedules

Role that lets EventBridge Scheduler invoke the Lambda:

```bash
aws iam create-role --role-name bethunana-scheduler --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
```

```bash
aws iam put-role-policy --role-name bethunana-scheduler --policy-name invoke-resize --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\"}]}"
```

The schedules (cron format `cron(min hour ? * days *)`, evaluated directly in
the given timezone — no UTC math):

```bash
aws scheduler create-schedule --region $REGION --name bethunana-micro-daily --schedule-expression "cron(0 1 ? * * *)" --schedule-expression-timezone "Africa/Johannesburg" --flexible-time-window '{"Mode":"OFF"}' --target "{\"Arn\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\",\"RoleArn\":\"arn:aws:iam::$ACCOUNT_ID:role/bethunana-scheduler\",\"Input\":\"{\\\"instance_type\\\": \\\"t3.micro\\\"}\"}"
```

```bash
aws scheduler create-schedule --region $REGION --name bethunana-small-weekday --schedule-expression "cron(0 16 ? * MON-FRI *)" --schedule-expression-timezone "Africa/Johannesburg" --flexible-time-window '{"Mode":"OFF"}' --target "{\"Arn\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\",\"RoleArn\":\"arn:aws:iam::$ACCOUNT_ID:role/bethunana-scheduler\",\"Input\":\"{\\\"instance_type\\\": \\\"t3.small\\\"}\"}"
```

```bash
aws scheduler create-schedule --region $REGION --name bethunana-small-weekend --schedule-expression "cron(0 9 ? * SAT,SUN *)" --schedule-expression-timezone "Africa/Johannesburg" --flexible-time-window '{"Mode":"OFF"}' --target "{\"Arn\":\"arn:aws:lambda:$REGION:$ACCOUNT_ID:function:bethunana-resize\",\"RoleArn\":\"arn:aws:iam::$ACCOUNT_ID:role/bethunana-scheduler\",\"Input\":\"{\\\"instance_type\\\": \\\"t3.small\\\"}\"}"
```

Note: each switch is ~2–3 minutes of downtime and the up-sizes currently fire
exactly at the start of the busy window (16:00 / 09:00). To avoid the outage
landing on arriving users, shift them slightly earlier, e.g.
`cron(50 15 ? * MON-FRI *)`.

#### 5d. Test end-to-end

Console: Lambda → `bethunana-resize` → Test tab → event
`{"instance_type": "t3.small"}` → Test. Or CLI:

```bash
aws lambda invoke --region $REGION --function-name bethunana-resize --payload '{"instance_type": "t3.small"}' --cli-binary-format raw-in-base64-out /dev/stdout
```

Takes ~2–3 minutes, then returns `{"changed": true, "type": "t3.small"}`.
Verify: EC2 console shows the new type and `running`; ~2 minutes later
`/api/health` answers again (proves the Elastic IP survived and PM2 + Caddy
resurrected on boot). Then resize back the same way. Both directions passing
means the schedules need no babysitting.

---

## History / decommissioned pieces

- The app previously ran on a Lightsail instance with a local MySQL database
  behind nginx. The database moved to Azure SQL (`bethunana.database.windows.net`,
  DB `BethunanaAcademyVideos`), the web server to Caddy, the host to EC2.
- `backend/schema/mysql-schema.sql` is the legacy MySQL schema, kept for
  reference. The live schema is `backend/schema/sqlserver-schema.sql`.
- The "Database Dump (legacy MySQL)" GitHub workflow dumps the old Lightsail
  MySQL — run it one final time before deleting the Lightsail instance if the
  old data might ever be needed, then the workflow can be deleted too.

## Cost sketch (af-south-1, rough)

| Item | Approx |
| --- | --- |
| t3.micro ~91 h/week | ~$5/mo |
| t3.small ~77 h/week | ~$9/mo |
| Elastic IP (attached) + 20GB gp3 | ~$3/mo |
| Lambda + Scheduler + CloudWatch | pennies |
| **Total** | **~$17/mo** |

Caveat: a stop/start cycle discards accrued t3 CPU burst credits, so the
instance starts each window with baseline credits only.
