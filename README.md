# Playtested

**Verified player-only game reviews across Steam, PlayStation, and Xbox.**  
No media scores. No critics. No paid influencers. No unverified review bombing.

Every score on Playtested is calculated on a **0–100 scale** weighted logarithmically by verified playtime (`1 + log10(1 + hours)`), with a minimum **2 hours played** required to review. Each platform (**Steam**, **PlayStation**, **Xbox**) is calculated **strictly individually** and never mixed across platforms.

---

## Why This Project Is Open Source

Playtested connects to players' gaming accounts exclusively to verify two facts:
1. You own or have played the game on that platform.
2. You have at least `MIN_HOURS` (default `2h`) of recorded playtime.

Everything is open source under the [MIT License](./LICENSE) so any player can inspect every line of authentication and API code in [`lib/platforms.js`](./lib/platforms.js):
- **Steam**: Standard Steam OpenID 2.0 + read-only `IPlayerService/GetOwnedGames`.
- **Xbox Live**: Standard Microsoft Live OAuth 2.0 (`XboxLive.signin`) → XBL → XSTS → read-only TitleHub & `MinutesPlayed`.
- **PlayStation Network**: Profile Bio Verification Challenge (one-time code placed temporarily in your PSN "About Me") or in-memory short-lived NPSSO exchange → read-only `gamelist/v2` `playDuration`. **Playtested never asks for your passwords and never writes platform tokens to disk.**

---

## Cross-Platform Unified Catalog (Zero Duplicates)

[`lib/dedupe.js`](./lib/dedupe.js) normalizes titles across Steam, PlayStation, Xbox, and IGDB (stripping storefront noise like `™`, `®`, `(PS5)`, `PS4 & PS5`, `Xbox Series X|S`, `Standard Edition` while keeping sequels and editions distinct) and merges external IDs (`steam`, `igdb`, `ps`, `xbox`) into one canonical game entry so the same game never appears twice.

---

## Running Locally

1. Install Node.js 18+ and dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` and set the environment variables you want to enable:
   - `STEAM_API_KEY` — Get from https://steamcommunity.com/dev/apikey
   - `XBOX_CLIENT_ID` & `XBOX_CLIENT_SECRET` — Create a free Microsoft Entra / Azure App Registration with redirect URI `http://localhost:3000/auth/xbox/return`
   - `PSN_NPSSO` — Optional service NPSSO token to enable one-time PSN Profile Bio verification (without it, direct in-memory NPSSO verification still works)
   - `TWITCH_CLIENT_ID` & `TWITCH_CLIENT_SECRET` — Free IGDB v4 access via https://dev.twitch.tv/console to index all PC, PlayStation, and Xbox games automatically
   - `SGDB_KEY` — Optional SteamGridDB cover fallback via https://www.steamgriddb.com/profile/preferences/api
3. Start the server:
   - **Windows CMD**:
     ```cmd
     set STEAM_API_KEY=YOUR_KEY&& npm start
     ```
   - **Windows PowerShell**:
     ```powershell
     $env:STEAM_API_KEY="YOUR_KEY"; npm start
     ```
   - **macOS / Linux**:
     ```bash
     STEAM_API_KEY=YOUR_KEY npm start
     ```
4. Open [http://localhost:3000](http://localhost:3000).

---

## Hosting From GitHub

> **Why not GitHub Pages directly?** GitHub Pages only serves static HTML/CSS/JS files and cannot run a Node.js backend, store secret API keys (`STEAM_API_KEY`, `XBOX_CLIENT_SECRET`), handle OAuth callbacks, or persist verified reviews.

Instead, keep your code public on **GitHub** and deploy directly from your GitHub repo using the included [`render.yaml`](./render.yaml) Blueprint (free tier on **Render**, or **Railway** / **Fly.io**):

1. Push this folder to a public GitHub repository (make sure `.env` is never committed — `.gitignore` blocks it automatically).
2. Sign in to [Render](https://render.com) with GitHub → **New +** → **Blueprint** → select your `playtested` repository.
3. Add your API keys in Render's Environment Variables panel and set `BASE_URL` to your Render HTTPS URL (e.g., `https://playtested.onrender.com`).
4. Update your Steam API key domain and Microsoft/Xbox OAuth Redirect URI (`https://playtested.onrender.com/auth/xbox/return`) to match `BASE_URL`.
