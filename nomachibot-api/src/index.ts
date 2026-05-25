import 'dotenv/config';
import express, { Request, Response } from 'express';
import { Telegraf, Markup } from 'telegraf';

// Environment variables
const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/nomachibot/app';

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in environment variables.');
  process.exit(1);
}

import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import contractRoutes from './routes/contract';

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' })); // Should be restricted in prod

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes); // NOTE: Fixed from /api to /api/user for clarity, but frontend is still calling /api/me. Let's make it /api for now to match earlier. Wait, let's keep it consistent. 
app.use('/api', userRoutes);
app.use('/api/contracts', contractRoutes);

// Hello World / Health API
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Initialize Telegraf Bot
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  const message = 'Welcome to NomachiBot! 🚀\n\nCreate, countersign, and publicly track zero-interest P2P debt agreements entirely inside Telegram.\n\nTap the button below to launch the Mini App.';
  
  ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.webApp('Launch NomachiBot', MINI_APP_URL)
  ]));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Start Telegram Bot
bot.launch().then(() => {
  console.log('🤖 Telegram Bot is running...');
}).catch((error) => {
  console.error('Failed to launch Telegram Bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
