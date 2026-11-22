# Deploying Playtested on Hetzner Cloud + Cloudflare + 5 TB Google Drive Backups

## 1. Create Your Hetzner Cloud Account (Private / Individual — No CNPJ Needed)
1. Sign up at [console.hetzner.cloud](https://console.hetzner.cloud) and choose **Private customer / Individual** (personal ID/card verification — no CNPJ required).
2. Create a new Project (e.g. `Playtested`) → **Add Server**:
   - **Location**: **Ashburn, VA (US-East)** for lowest latency to Brazil + US players (or Falkenstein/Nuremberg EU).
   - **Image**: **Ubuntu 24.04**
   - **Type**:
     - **Shared vCPU → Arm64 → `CAX11`** (2 vCPU, 4 GB RAM, 40 GB NVMe SSD, 20 TB traffic — ~€3.79/mo) **OR**
     - **Shared vCPU → x86 → `CPX11` / `CX22`** (~€4.35/mo, available in Ashburn US-East)
   - **Networking**: Keep **Public IPv4** checked.
   - **SSH keys**: Paste your `id_ed25519.pub` public key.
   - **Name**: `playtested`
3. Click **Create & Buy now** and copy the server's **IPv4 address**.

## 2. Point Your Domain via Cloudflare (Free Plan)
1. In [dash.cloudflare.com](https://dash.cloudflare.com) → **DNS → Records**:
   - Add `A` record: Name `@` (or `playtested`), IPv4 = your Hetzner IP, **Proxied (orange cloud)**.
2. **SSL/TLS → Overview**: Set to **Full (strict)**.
3. **Security → Bots**: Turn on **Bot Fight Mode**.

## 3. Run the Turnkey Installer on Your Hetzner Server
```bash
ssh root@YOUR_HETZNER_IP
git clone https://github.com/joaodestro7/playtested.git /opt/playtested
cd /opt/playtested
bash deploy/setup-hetzner-vps.sh yourdomain.com
```
Then copy your local `.env` values into `/opt/playtested/.env` (with `BASE_URL=https://yourdomain.com`), run `systemctl restart playtested`, and connect Google Drive backups with `rclone config` (remote name: `gdrive`).
