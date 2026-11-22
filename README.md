# Playtested

**Live site:** [https://playtested.party](https://playtested.party)

**Verified player-only game reviews across Steam, PlayStation, and Xbox.**  
No media scores. No critics. No paid influencers. No unverified review bombing.

Every score on Playtested is calculated on a **0–100 scale** weighted logarithmically by verified playtime (`1 + log10(1 + hours)`), with a minimum **2 hours played** required to review. Each platform (**Steam**, **PlayStation**, **Xbox**) is calculated **strictly individually** and never mixed across platforms.

---

## Why This Code Is Publicly Visible

Playtested connects to players' gaming accounts exclusively to verify two facts:
1. You own or have played the game on that platform.
2. You have at least **2 hours** of recorded playtime *(waived only for pre-API classic-era games such as PS1–PS3 and Original Xbox, where platform login is still required)*.

The source code is published here for **public security and transparency auditing** so any player can inspect every line of authentication and verification logic in [`lib/platforms.js`](./lib/platforms.js) and [`server.js`](./server.js):
- **Steam**: Standard Steam OpenID 2.0 + read-only owned games & playtime lookup.
- **Xbox Live**: Read-only Gamertag ownership verification + title history & playtime lookup.
- **PlayStation Network**: Read-only account verification + PS4/PS5 game list & playtime lookup.
- **Zero password collection**: Playtested never asks for your gaming account passwords and never writes to your accounts.

---

## License & Usage Rights

This repository is **source-available for public inspection and security auditing only**.  
**All rights reserved.** You may view and audit the code to verify there is no malicious behavior, and you are welcome to report bugs or security issues. Copying, redistributing, re-hosting, deploying public or commercial clones, or reusing the Playtested brand and assets without prior written permission is **not permitted**.

See [`LICENSE`](./LICENSE) for full terms.
