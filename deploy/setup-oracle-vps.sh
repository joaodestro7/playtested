#!/usr/bin/env bash
set -euo pipefail

# Turnkey setup for Playtested on Oracle Cloud Always Free Ubuntu (ARM64 or AMD64)
# Usage: sudo bash deploy/setup-oracle-vps.sh yourdomain.com

DOMAIN="${1:-}"
if [[ -z "${DOMAIN}" ]]; then
  echo "Usage: sudo bash deploy/setup-oracle-vps.sh yourdomain.com"
  exit 1
fi

APP_DIR="/opt/playtested"

echo "==> 1. Updating packages & installing Node.js 22, Caddy, rclone, git..."
apt-get update -y
apt-get install -y curl gnupg ca-certificates git debian-keyring debian-archive-keyring apt-transport-https

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

# rclone (for automated Google Drive backups)
if ! command -v rclone >/dev/null 2>&1; then
  curl -fsSL https://rclone.org/install.sh | bash
fi

echo "==> 2. Opening HTTP/HTTPS ports in Ubuntu firewall (iptables + ufw)..."
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save || true
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

echo "==> 3. Creating playtested system user & installing npm dependencies..."
id -u playtested >/dev/null 2>&1 || useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin playtested
chown -R playtested:playtested "${APP_DIR}"
sudo -u playtested npm --prefix "${APP_DIR}" ci --omit=dev || sudo -u playtested npm --prefix "${APP_DIR}" install --omit=dev

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  sed -i "s|BASE_URL=http://localhost:3000|BASE_URL=https://${DOMAIN}|g" "${APP_DIR}/.env"
  chown playtested:playtested "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  echo "Created ${APP_DIR}/.env — edit it now to add your API keys & DONATE_URL!"
fi

echo "==> 4. Configuring Caddy reverse proxy for ${DOMAIN}..."
sed "s|playtested.example.com|${DOMAIN}|g" "${APP_DIR}/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

echo "==> 5. Installing Playtested systemd service..."
cp "${APP_DIR}/deploy/playtested.service" /etc/systemd/system/playtested.service
systemctl daemon-reload
systemctl enable --now playtested

echo "==> 6. Installing daily 03:00 UTC Google Drive backup cron job..."
chmod +x "${APP_DIR}/deploy/backup-to-gdrive.sh"
cat <<'EOF' > /etc/cron.d/playtested-backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 3 * * * root /opt/playtested/deploy/backup-to-gdrive.sh >> /var/log/playtested-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/playtested-backup

echo ""
echo "=================================================================="
echo "Playtested installed!"
echo "Next steps:"
echo "  1. Edit /opt/playtested/.env with your API keys and DONATE_URL"
echo "  2. Restart service: sudo systemctl restart playtested"
echo "  3. Connect Google Drive backup: sudo rclone config (remote name: gdrive)"
echo "  4. Test backup once: sudo /opt/playtested/deploy/backup-to-gdrive.sh"
echo "  5. Check health: curl -s https://${DOMAIN}/health"
echo "=================================================================="
