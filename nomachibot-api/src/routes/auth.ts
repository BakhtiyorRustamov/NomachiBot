import express, { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const BOT_TOKEN = process.env.BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

if (!BOT_TOKEN || !JWT_SECRET) {
  throw new Error("Missing BOT_TOKEN or JWT_SECRET in environment variables");
}

router.post('/telegram', async (req: Request, res: Response) => {
  const { initData } = req.body;

  if (!initData) {
    res.status(400).json({ error: 'Missing initData' });
    return;
  }

  // 1. Parse initData
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  // 2. Sort keys and create data_check_string
  const keys = Array.from(urlParams.keys()).sort();
  const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

  // 3. Generate Secret Key
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();

  // 4. Generate Hash and Compare
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) {
    res.status(403).json({ error: 'Invalid hash' });
    return;
  }

  // 5. Validate Timestamp (max 1 hour old)
  const authDate = parseInt(urlParams.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 3600) {
    res.status(403).json({ error: 'Data is too old' });
    return;
  }

  // 6. Extract User Data
  const userString = urlParams.get('user');
  if (!userString) {
    res.status(400).json({ error: 'Missing user data' });
    return;
  }

  try {
    const tgUser = JSON.parse(userString);

    // Upsert User in DB
    const user = await prisma.user.upsert({
      where: { telegram_id: BigInt(tgUser.id) },
      update: {
        first_name: tgUser.first_name,
        last_name: tgUser.last_name || null,
        username: tgUser.username || null,
      },
      create: {
        telegram_id: BigInt(tgUser.id),
        first_name: tgUser.first_name,
        last_name: tgUser.last_name || null,
        username: tgUser.username || null,
      }
    });

    // 7. Generate JWT
    const token = jwt.sign(
      { id: user.id, telegram_id: tgUser.id.toString(), username: tgUser.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, first_name: user.first_name, last_name: user.last_name, username: user.username } });
  } catch (error) {
    console.error('Error processing Telegram auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
