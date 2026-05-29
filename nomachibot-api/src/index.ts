import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Telegraf, Markup } from 'telegraf';
import { validateEnv } from './env';

// Fail fast if any required env vars are missing or weak.
validateEnv();

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN!; // validated above
const MINI_APP_URL = process.env.MINI_APP_URL || '';
const FRONTEND_URL = process.env.FRONTEND_URL || '';

import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import contractRoutes from './routes/contract';
import publicRoutes from './routes/public';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Trust the first proxy hop so express-rate-limit reads the correct client IP
// from X-Forwarded-For when running behind Render / Nginx / a CDN. Without
// this, all requests appear to come from the proxy and one bad actor would
// burn the rate-limit budget for everyone.
app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allowlist for the authenticated /api/* surface. Anything not in this list
// is rejected. Public /public/* endpoints (QR target) use a permissive policy
// further down — those are intentionally world-readable.
const apiAllowlist = new Set<string>(
  [
    FRONTEND_URL,
    'https://web.telegram.org',
    'https://t.me',
    // Allow local dev (vite default + a couple of common alternatives)
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ].filter(Boolean),
);

const apiCors = cors({
  origin(origin, cb) {
    // Same-origin / curl / server-to-server requests have no Origin header.
    // Allow them so health checks and bot webhooks aren't blocked.
    if (!origin) return cb(null, true);
    if (apiAllowlist.has(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
});

// Public surface is open by design — the public status page must be reachable
// from any browser that scanned the QR code.
const publicCors = cors({ origin: '*' });

// ── Rate limits ──────────────────────────────────────────────────────────────
// SRS §1.12: 20 req/hr per IP on auth endpoints to slow credential stuffing /
// init-data replay attempts.
const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' },
});

// Public routes — no auth (QR target, photo serving, PDF download)
app.use('/public', publicCors, publicRoutes);

// Authenticated API routes. /api/auth uses the same allowlist as the rest —
// the Mini App POSTs initData from the Vercel origin, which is on the list.
app.use('/api/auth', apiCors, authRateLimit, authRoutes);
app.use('/api', apiCors, userRoutes);
app.use('/api/contracts', apiCors, contractRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root handler so monitors that ping `/` (UptimeRobot, Render's own health
// probe, etc.) get a 200 instead of a 404. Same payload as /health.
app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'nomachibot-api', status: 'ok', timestamp: new Date().toISOString() });
});

const bot = new Telegraf(BOT_TOKEN);
export { bot };

bot.start(async (ctx) => {
  try {
    if (MINI_APP_URL) {
      await ctx.reply(
        'Welcome to NomachiBot!\n\nCreate, countersign, and publicly track zero-interest P2P debt agreements entirely inside Telegram.\n\nTap the button below to launch the Mini App.',
        Markup.inlineKeyboard([Markup.button.webApp('Launch NomachiBot', MINI_APP_URL)]),
      );
    } else {
      // MINI_APP_URL not configured — send a plain text reply so the bot doesn't crash
      await ctx.reply(
        'Welcome to NomachiBot!\n\nCreate, countersign, and publicly track zero-interest P2P debt agreements entirely inside Telegram.\n\n(Mini App URL not configured yet.)',
      );
    }
  } catch (err) {
    console.error('bot.start reply error:', err);
    // Swallow the error — don't let a single /start message crash the server
    try {
      await ctx.reply('Welcome to NomachiBot! The app link is being configured — please try again shortly.');
    } catch { /* ignore */ }
  }
});

app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});

bot.launch().then(() => {
  console.log('Telegram Bot is running...');
}).catch((error) => {
  console.error('Failed to launch Telegram Bot:', error);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
