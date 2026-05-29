# Phase 9 — Security Hardening & Launch

This document tracks what shipped in Phase 9 and what the operator still has
to do outside the codebase (env vars, cron, monitoring).

## What ships in code

### Startup environment validation — `src/env.ts`
`validateEnv()` runs at boot. It refuses to start if `DATABASE_URL`,
`BOT_TOKEN`, or `JWT_SECRET` are missing, and if `JWT_SECRET` is shorter
than 32 characters. It logs a warning (but does not crash) if
`FRONTEND_URL`, `MINI_APP_URL`, or `STORAGE_PATH` are missing.

### CORS allowlist — `src/index.ts`
`/api/*` accepts requests only from `FRONTEND_URL`, `https://web.telegram.org`,
`https://t.me`, and the common local-dev origins. Anything else is rejected
with a CORS error. `/public/*` stays open by design — the QR target must be
reachable from any browser. `trust proxy` is set to `1` so
`express-rate-limit` reads the real client IP behind Render / Nginx.

### Rate limits
- `/api/auth/*` — 20 requests / hour / IP (`authRateLimit`).
- `/public/*` — 120 requests / hour / IP (`publicRateLimit`, unchanged).

### Upload validation — `src/utils/upload.ts`
Every selfie upload (`/lender-confirm`, `/witness-confirm/:n`, `/photo`) is
validated by reading the file's magic bytes via the `file-type` package.
Anything that's not `image/jpeg`, `image/png`, or `image/webp` is rejected
with `415 Unsupported Media Type`. The 5 MB cap is enforced both by multer
and re-checked in `validatePhotoUpload`.

### Invite token expiry — `src/routes/contract.ts`
Tokens become invalid 30 days after the contract is created. Enforced at
`/preview`, `/lender-confirm`, and `/witness-confirm/:n`. Single-use is
already enforced by the `confirmed_at` check.

### HTML injection
N/A — PDFs are rendered by PDFKit (no HTML template), and the React
frontend escapes by default. No code path interpolates user input into
HTML.

## What the operator does outside the codebase

### Required env vars on Render

```
DATABASE_URL    postgresql://…
BOT_TOKEN       (from @BotFather)
JWT_SECRET      openssl rand -hex 32
FRONTEND_URL    https://nomachi-bot.vercel.app
MINI_APP_URL    https://t.me/<your-bot>/app
PUBLIC_BASE_URL https://nomachibot.onrender.com   (this API host)
STORAGE_PATH    /var/data/nomachibot              (or Render disk mount path)
```

### Daily database backup
The dump script lives at `scripts/backup.sh`. On a VPS:

```bash
chmod +x scripts/backup.sh
crontab -e
# Add:
0 3 * * *  DATABASE_URL='postgresql://…'  /opt/nomachibot-api/scripts/backup.sh >> /var/log/nomachibot-backup.log 2>&1
```

On Render, schedule the same command as a daily Cron Job pointing at
`scripts/backup.sh`. After the first run, do a restore test:

```bash
gunzip -c /var/backups/nomachibot/nomachibot_*.sql.gz | psql "$RESTORE_TARGET_URL"
```

### Monitoring
- UptimeRobot or similar: monitor `https://<api-host>/health` every 5 minutes.
- PM2 (if self-hosting): `pm2 logs --lines 200` for tailing; rotate logs with
  `pm2 install pm2-logrotate`.
- Disk usage alert: `df -h` cron alert at 80% capacity.
