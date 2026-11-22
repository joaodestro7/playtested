# Deploying Playtested on Google Cloud Run (\$0 Free Tier) + Neon Free PostgreSQL

Zero CNPJ needed (choose **Individual / CPF** on Google Cloud Billing). Zero monthly bill to start — scales automatically from 0 to millions of requests per month.

---

## Step 1 — Create Your Free Neon PostgreSQL Database (\$0/mo)

1. Go to [console.neon.tech](https://console.neon.tech) and click **Sign in with GitHub** *(no credit card, no CNPJ)*.
2. Click **Create a project**:
   - **Project name**: `playtested`
   - **Region**: **US East (N. Virginia)** (`us-east-1`) or **São Paulo** (`sa-east-1`)
3. Click **Connect** and copy the **Connection string** (`postgresql://neondb_owner:...@...neon.tech/neondb?sslmode=require`).
   - Save this — it will be your `DATABASE_URL` environment variable!
   - On first boot, Playtested automatically creates the `games`, `reviews`, `sessions`, and `kv_state` tables and seeds all **7,469** deduplicated games from `db.json`.

---

## Step 2 — Deploy to Google Cloud Run (\$0 Always-Free Tier)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with your Google account.
2. Create a new project called **`playtested`**.
3. If prompted to enable Billing, select **Account type: Individual (Pessoa Física — CPF)** *(no CNPJ needed; Always-Free tier includes **2 million requests/month** free)*.
4. In the top search bar, search for **Cloud Run** → click **Deploy container** → **Service**:
   - Choose **Continuously deploy from a repository (source or function)** → click **Set up with Cloud Build** → connect your GitHub account → select **`joaodestro7/playtested`**, branch `main`, Build Type: **Dockerfile** (`/Dockerfile`).
   - **Region**: `us-central1` or `us-east1` *(Tier 1 Always-Free regions — guaranteed \$0 free tier!)*.
   - **Authentication**: Select **Allow unauthenticated invocations** (so the public can visit your website!).
   - **CPU allocation & pricing**: **CPU is only allocated during request processing** (scales to zero when idle = \$0/mo!).
   - **Minimum instances**: `0` | **Maximum instances**: `3` *(protects you from accidental runaway bills!)*.
   - **Memory**: `512 MiB` | **CPU**: `1`.
5. Expand **Container(s), Volumes, Networking, Security → Variables & Secrets** and add your environment variables:
   - `DATABASE_URL` = *(your Neon PostgreSQL connection string from Step 1)*
   - `STEAM_API_KEY` = *(your Steam Web API key)*
   - `SGDB_KEY` = *(your SteamGridDB key)*
   - `OPENXBL_KEY` = *(your OpenXBL key)*
   - `DONATE_URL` = `https://www.paypal.com/donate?business=joaovictordestro%40hotmail.com&no_recurring=0&item_name=Support+Playtested+%E2%80%94+Verified+Player+Reviews&currency_code=USD`
   - `MIN_HOURS` = `2`
   - `CRON_SECRET` = *(any random secret string, e.g. `pt-sync-9842`)*
6. Click **Create**! Cloud Build builds your `Dockerfile` and deploys Playtested in ~90 seconds.
7. Once deployed, copy the live HTTPS URL Cloud Run gives you (e.g. `https://playtested-xxxxx-uc.a.run.app`):
   - Click **Edit & Deploy New Revision** → add `BASE_URL` = `https://playtested-xxxxx-uc.a.run.app` (or your custom domain once mapped!) → **Deploy**.
   - Visit `https://YOUR_CLOUD_RUN_URL/health` — it will return `{"ok":true,"storage":"postgres","games":7469,"reviews":0}`!

---

## Step 3 — (Optional) Custom Domain + Cloudflare Free CDN & DDoS Shield

1. In Cloud Run → **Manage Custom Domains** → map your domain (e.g. `playtested.gg`), or point Cloudflare directly to your Cloud Run domain mapping.
2. Update `BASE_URL=https://yourdomain.com` in Cloud Run and update your Steam API key domain at `steamcommunity.com/dev/apikey`.
3. *(Optional)* Create a free **Google Cloud Scheduler** job (3 free jobs/month) to POST `https://YOUR_URL/api/cron/sync` with header `x-cron-secret: YOUR_CRON_SECRET` once a day so Steam trending charts and cross-generation games stay fresh automatically!

---

## Step 4 — Budget Guardrail (Stay at \$0)
In Google Cloud Console → **Billing → Budgets & alerts**, create a **\$1 / month** alert budget so Google emails you immediately if traffic ever grows beyond the 2 million/month Always-Free tier!
