#!/usr/bin/env bash
# ============================================================
# One-time bootstrap for a fresh Ubuntu 22.04/24.04 EC2 instance
# running the Bethunana Academy app (API + worker behind Caddy).
#
# Run as the 'ubuntu' user:
#   bash ec2-setup.sh
#
# After it finishes:
#   1. Put real values in /home/ubuntu/BethunanaAcademy/backend/.env
#   2. Allow this instance's Elastic IP in the Azure SQL firewall
#   3. pm2 restart BethunanaAcademy
#
# HTTPS is automatic: once the domain's DNS points at this instance,
# Caddy obtains and renews Let's Encrypt certificates on its own.
# ============================================================
set -euo pipefail

APP_DIR="/home/ubuntu/BethunanaAcademy"
REPO_URL="https://github.com/Teboho02/BethunanaAcademyVideos.git"
DOMAIN="bethunanaacademy.co.za"

# ------------------------------------------------------------
# 2GB swap — required: t3.nano has 512MB RAM and the deploy
# workflow builds the frontend (vite) and backend (tsc) on-box.
# ------------------------------------------------------------
if [ ! -f /swapfile ]; then
  echo ">>> Creating 2GB swap file..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# ------------------------------------------------------------
# Node.js 22 (also satisfies the tedious/mssql engine requirement)
# ------------------------------------------------------------
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  echo ">>> Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo ">>> Node: $(node --version) | npm: $(npm --version)"

# ------------------------------------------------------------
# PM2 + git
# ------------------------------------------------------------
sudo npm install -g pm2
sudo apt-get update
sudo apt-get install -y git

# ------------------------------------------------------------
# Caddy (official apt repository)
# ------------------------------------------------------------
if ! command -v caddy &> /dev/null; then
  echo ">>> Installing Caddy..."
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo apt-get install -y caddy
fi
echo ">>> Caddy: $(caddy version)"

# ------------------------------------------------------------
# App checkout + first build
# ------------------------------------------------------------
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi
cd "${APP_DIR}"
npm install
npm run build
cd "${APP_DIR}/backend"
npm install
npm run build

# ------------------------------------------------------------
# Caddyfile: reverse proxy -> Node on :4000, automatic HTTPS.
# The 1GB request body cap matches the app's MAX_UPLOAD_BYTES.
#
# Until DNS points here, certificate issuance fails and Caddy
# retries on its own — it resolves itself after DNS cutover. To
# test by IP before cutover, uncomment the :80 block below.
# ------------------------------------------------------------
sudo tee /etc/caddy/Caddyfile > /dev/null <<CADDY
${DOMAIN}, www.${DOMAIN} {
    reverse_proxy 127.0.0.1:4000
    request_body {
        max_size 1GB
    }
}

# :80 {
#     reverse_proxy 127.0.0.1:4000
# }
CADDY
sudo systemctl enable caddy
sudo systemctl reload caddy || sudo systemctl restart caddy

# ------------------------------------------------------------
# .env template (fill in the real password before starting)
# ------------------------------------------------------------
if [ ! -f "${APP_DIR}/backend/.env" ]; then
  tee "${APP_DIR}/backend/.env" > /dev/null <<'ENV'
SQLSERVER_HOST=bethunana.database.windows.net
SQLSERVER_PORT=1433
SQLSERVER_USER=Teboho
SQLSERVER_PASSWORD=CHANGE_ME
SQLSERVER_DATABASE=BethunanaAcademyVideos
SQLSERVER_ENCRYPT=true

PORT=4000

S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=CHANGE_ME
S3_SECRET_ACCESS_KEY=CHANGE_ME
S3_BUCKET=bethunana
S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
CDN_BASE_URL=https://d2d8mtr7izdq47.cloudfront.net
ENV
  echo ">>> WROTE ${APP_DIR}/backend/.env — EDIT IT with real credentials!"
fi

# ------------------------------------------------------------
# Start under PM2 and survive reboots (resize = stop/start,
# so pm2 resurrect-on-boot is what brings the app back up)
# ------------------------------------------------------------
cd "${APP_DIR}/backend"
pm2 start npm --name "BethunanaAcademy" -- run start || pm2 restart BethunanaAcademy
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo ">>> Done. Edit backend/.env, then: pm2 restart BethunanaAcademy"
echo ">>> HTTPS activates automatically once DNS for ${DOMAIN} points at this instance."
