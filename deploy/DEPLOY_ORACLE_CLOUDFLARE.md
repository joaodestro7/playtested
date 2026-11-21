# Deploying Playtested on Oracle Cloud Always Free + Cloudflare + Google Drive Backups

This stack gives you **\$0/month hosting** with **no sleep/cold starts**, **free CDN + SSL + DDoS protection via Cloudflare**, and **automated daily compressed backups of `db.json` to your 5 TB Google Drive**.

---

## Step 1 — Create Your Oracle Cloud Always Free VM (\$0/mo)

1. Sign up / sign in at [cloud.oracle.com](https://cloud.oracle.com) (free tier requires a card for identity verification; staying inside **Always Free** limits costs \$0).
2. Go to **Compute → Instances → Create instance**:
   - **Name**: `playtested`
   - **Image**: **Ubuntu 24.04** (or 22.04)
   - **Shape**: Click **Change shape** → **Ampere (ARM)** → `VM.Standard.A1.Flex`
     - Set **4 OCPUs** and **24 GB RAM** (all inside Always Free! If your region temporarily reports "Out of host capacity" for 4 OCPUs, try **2 OCPUs / 12 GB RAM**, another Availability Domain, or start on `VM.Standard.E2.1.Micro` and resize later).
   - **Boot volume**: Up to **200 GB** (free tier includes 200 GB total block storage; 50–100 GB is plenty).
   - **SSH keys**: Download and save the private key (`.key` file).
3. Click **Create** and note the instance's **Public IPv4 address**.
4. Open HTTP/HTTPS ports in Oracle's Virtual Cloud Network:
   - On the instance page, click your **Subnet** → **Default Security List** → **Add Ingress Rules**:
     - Rule 1: Source CIDR `0.0.0.0/0`, Protocol `TCP`, Destination Port `80`
     - Rule 2: Source CIDR `0.0.0.0/0`, Protocol `TCP`, Destination Port `443`

---

## Step 2 — Point Your Domain Through Cloudflare (Free CDN + DDoS + SSL)

1. Add your domain to [Cloudflare](https://dash.cloudflare.com) (Free plan) and update your domain registrar's nameservers to Cloudflare's.
2. In Cloudflare **DNS → Records**, add an `A` record:
   - **Name**: `@` (or `playtested` for a subdomain)
   - **IPv4 address**: your Oracle VM Public IP
   - **Proxy status**: **Proxied (orange cloud)**
3. In Cloudflare **SSL/TLS → Overview**:
   - Set encryption mode to **Full (strict)** (Caddy on your Oracle VM automatically provisions a valid TLS certificate).
4. In Cloudflare **Security → Bots**:
   - Enable **Bot Fight Mode** (free anti-bot & DDoS shield).
5. *(Recommended for scaling)* Playtested already sends Cloudflare edge-caching headers (`Cache-Control: public, max-age=15, s-maxage=30` on `/api/games` and `/api/stats`, `max-age=86400` on images, and `private, no-store` on `/auth/*`, `/api/me`, `/api/library`, `/api/review`). In Cloudflare **Caching → Cache Rules**, you can optionally add a rule to cache `/api/games*` and `/api/stats` honoring origin Cache-Control to offload 80–90% of read traffic for free.

---

## Step 3 — Install Playtested on the Oracle VM

SSH into your Oracle VM from Windows PowerShell:

```powershell
ssh -i path\to\your-oracle-key.key ubuntu@YOUR_ORACLE_PUBLIC_IP
```

Clone your private GitHub repository into `/opt/playtested` (create a fine-grained read-only GitHub token or SSH deploy key):

```bash
sudo mkdir -p /opt/playtested
sudo chown ubuntu:ubuntu /opt/playtested
git clone https://github.com/joaodestro7/playtested.git /opt/playtested
cd /opt/playtested
```

Run the turnkey installer (replace `yourdomain.com` with your real domain):

```bash
sudo bash deploy/setup-oracle-vps.sh yourdomain.com
```

Edit `/opt/playtested/.env` and paste your production values (`BASE_URL=https://yourdomain.com`, `STEAM_API_KEY`, `SGDB_KEY`, `OPENXBL_KEY`, `DONATE_URL`, and optional `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` or `PSN_NPSSO`):

```bash
sudo nano /opt/playtested/.env
sudo systemctl restart playtested
```

Verify it is running cleanly:

```bash
sudo systemctl status playtested
curl -s https://yourdomain.com/health
```

> **Don't forget:** Update your Steam Web API key domain at `steamcommunity.com/dev/apikey` (or generate one for `yourdomain.com`).

---

## Step 4 — Connect Daily Backups to Your 5 TB Google Drive

On your Oracle VM, run:

```bash
sudo rclone config
```

1. Type `n` (New remote) → Name: **`gdrive`**
2. Choose **Google Drive** (`drive`)
3. Leave `client_id` and `client_secret` blank (press Enter)
4. Scope: choose `1` (Full access) or `3` (Files created by rclone only — safest!)
5. At **"Use web browser to automatically authenticate?"**, choose **`n`** (since the VM is headless).
6. On your Windows PC (where a browser is open), run `rclone authorize "drive"`, sign into your Google account, copy the token string, and paste it back into the Oracle VM terminal.
7. Test your first backup right away:
   ```bash
   sudo /opt/playtested/deploy/backup-to-gdrive.sh
   ```
   Check your Google Drive — you will see `Playtested-Backups/playtested-db-latest.json.gz` and timestamped daily archives! The cron job in `/etc/cron.d/playtested-backup` now backs up `db.json` automatically every day at **03:00 UTC** and retains 90 days of history.

---

## Updating Playtested Later

Whenever you push new code to GitHub:

```bash
cd /opt/playtested
sudo -u playtested git pull
sudo -u playtested npm install --omit=dev
sudo systemctl restart playtested
```
