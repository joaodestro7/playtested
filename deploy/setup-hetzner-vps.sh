#!/usr/bin/env bash
set -euo pipefail

# Turnkey setup for Playtested on Hetzner Cloud Ubuntu 24.04 (CAX11 ARM64 or CX22 x86)
# Usage: sudo bash deploy/setup-hetzner-vps.sh yourdomain.com

DOMAIN="${1:-}"
if [[ -z "${DOMAIN}" ]]; then
  echo "Usage: sudo bash deploy/setup-hetzner-vps.sh yourdomain.com"
  exit 1
fi

APP_DIR="/opt/playtested"

echo "==> 1. Adding 2 GB swapfile (headroom for continuous catalog indexing)..."
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 2. Updating packages & installing Node.js 22, Caddy, rclone, git, ufw..."
apt-get update -y
apt-get install -y curl gnupg ca-certificates git ufw debian-keyring debian-archive-keyring apt-transport-https

# Node.js 22 LTS
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Caddy (automatic HTTPS + reverse proxy)
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# rclone (daily encrypted-transport backups to Google Drive)
if ! command -v rclone >/dev/null 2>&1; then
  curl -fsSL https://rclone.org/install.sh | bash
fi

echo "==> 3. Configuring UFW firewall (SSH 22, HTTP 80, HTTPS 443)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 4. Creating playtested system user & installing npm dependencies..."
id -u playtested >/dev/null 2>&1 || useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin playtested
chown -R playtested:playtested "${APP_DIR}"
sudo -u playtested npm --prefix "${APP_DIR}" ci --omit=dev || sudo -u playtested npm --prefix "${APP_DIR}" install --omit=dev

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  sed -i "s|BASE_URL=http://localhost:3000|BASE_URL=https://${DOMAIN}|g" "${APP_DIR}/.env"
  chown playtested:playtested "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
fi

echo "==> 5. Configuring Caddy reverse proxy for ${DOMAIN}..."
sed "s|playtested.example.com|${DOMAIN}|g" "${APP_DIR}/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

echo "==> 6. Installing Playtested systemd service..."
cp "${APP_DIR}/deploy/playtested.service" /etc/systemd/system/playtested.service
systemctl daemon-reload
systemctl enable --now playtested

echo "==> 7. Scheduling daily 03:00 UTC Google Drive backup cron job..."
chmod +x "${APP_DIR}/deploy/backup-to-gdrive.sh"
cat <<'EOF' > /etc/cron.d/playtested-backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 3 * * * root /opt/playtested/deploy/backup-to-gdrive.sh >> /var/log/playtested-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/playtested-backup

echo ""
echo "=================================================================="
echo "Playtested is installed on Hetzner Cloud!"
echo "Verify: curl -s https://${DOMAIN}/health"
echo "=================================================================="
