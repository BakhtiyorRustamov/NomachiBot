import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Telegraf, Markup } from 'telegraf';

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/nomachibot/app';

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in environment variables.');
  process.exit(1);
}

import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import contractRoutes from './routes/contract';
import publicRoutes from './routes/public';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cors({ origin: '*' }));

// Public routes — no auth (QR target, photo serving, PDF download)
app.use('/public', publicRoutes);

// Authenticated API routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/contracts', contractRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    'Welcome to NomachiBot!\n\nCreate, countersign, and publicly track zero-interest P2P debt agreements entirely inside Telegram.\n\nTap the button below to launch the Mini App.',
    Markup.inlineKeyboard([Markup.button.webApp('Launch NomachiBot', MINI_APP_URL)]),
  );
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
