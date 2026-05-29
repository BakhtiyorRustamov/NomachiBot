# NomachiBot — finish deployment

Follow these steps in order. Total time: about 10 minutes.

---

## 1. Push the code to GitHub

Double-click `push-to-github.ps1` (or right-click → "Run with PowerShell").
It will ask for:

- Your GitHub username (default: `BakhtiyorRustamov`).
- A GitHub Personal Access Token with `repo` scope. Create one at
  https://github.com/settings/tokens?type=beta
  Scope: only the `NomachiBot` repository; permission "Contents: Read and write".
- Your commit author name and email (first run only).

The script initialises git, stages everything, commits, and force-pushes to
`main`. Render will start auto-deploying the moment the push lands.

---

## 2. Set environment variables in Render

Open https://dashboard.render.com → your `nomachibot-api` service → Environment.
Add or update:

| Key             | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| `JWT_SECRET`    | `14e26a3e3b14ae0b9f9cb57298f7d067cc4c2fc9c30762c20c7ad522d5f08db2` |
| `FRONTEND_URL`  | `https://nomachi-bot.vercel.app` (already done — confirm it's set) |
| `MINI_APP_URL`  | `https://t.me/<your-bot>/app`                                      |
| `PUBLIC_BASE_URL` | `https://nomachibot.onrender.com`                                |
| `STORAGE_PATH`  | `/var/data/nomachibot` (only if you attached a persistent disk)    |

The `JWT_SECRET` above was generated for you with `crypto.randomBytes(32)`.
If you'd rather use your own, run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Anything shorter than 32 characters will make the server refuse to start
(`validateEnv()` checks this).

Click **Save Changes** and Render will redeploy.

---

## 3. Set up daily database backups

Backups run via GitHub Actions (`.github/workflows/db-backup.yml`) — free,
no Render paid plan needed. One-time setup:

1. Open https://github.com/BakhtiyorRustamov/NomachiBot/settings/secrets/actions
2. Click **New repository secret**.
3. Name: `DATABASE_URL` — Value: the same Postgres connection string Render
   uses for the API (Render dashboard → your Postgres → "External Database URL").
4. Save.

The workflow runs every day at 03:00 UTC. To verify, go to the **Actions**
tab → "Daily database backup" → **Run workflow** → branch `main`. After a
successful run, the dump appears as a downloadable artifact on the workflow
run page (GitHub keeps it for 90 days).

To restore:

```bash
gunzip -c nomachibot_*.sql.gz | psql "$RESTORE_URL"
```

---

## 4. Fix UptimeRobot — it's currently DOWN

Your monitor says "Currently down for 3d 12h 52m" because it's pinging the
root URL `https://nomachibot.onrender.com`, which previously returned 404.
After the deploy in step 1, root will return 200 (I added a root handler).

You have two options:

**Option A (recommended):** keep the URL as-is. The next ping after deploy
will succeed and the monitor will flip to UP.

**Option B:** change the monitor URL to
`https://nomachibot.onrender.com/health` for a tighter probe.
Edit the monitor → URL → save.

Free-tier Render services also spin down after ~15 min idle. UptimeRobot's
5-minute ping interval keeps it warm — that's why monitoring is part of the
deploy story, not just observability.

---

## 5. Verify everything works

After step 1 finishes and Render redeploys (watch the deploy log in Render),
test in this order:

1. `curl https://nomachibot.onrender.com/` → `{"service":"nomachibot-api","status":"ok",...}`
2. `curl https://nomachibot.onrender.com/health` → `{"status":"ok",...}`
3. UptimeRobot dashboard should flip to UP within 5 minutes.
4. Open the Mini App in Telegram, create a test contract, confirm as lender
   from a second device, click "View Public Status Page" — should open
   `nomachi-bot.vercel.app/status/<uuid>` (not the Render URL).
5. Run the GitHub Action manually once to make sure the backup workflow has
   the right secret.

If anything goes red, the Render service logs are the fastest source of
truth — `validateEnv()` prints exactly which env var is missing on startup.
