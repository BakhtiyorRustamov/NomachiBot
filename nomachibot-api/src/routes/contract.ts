import express, { Response } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for selfie uploads (temporarily in memory, then processed)
const upload = multer({ 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

const generateInviteToken = () => crypto.randomBytes(32).toString('hex');

// POST /api/contracts - Create draft contract (borrower only)
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { 
      totalAmount, monthlyAmount, currency, description, language,
      borrower, lender, witnesses 
    } = req.body;

    // Basic validation
    if (!totalAmount || !monthlyAmount || !lender?.username) {
      res.status(400).json({ error: 'Missing mandatory fields' });
      return;
    }

    const nMonths = Math.ceil(totalAmount / monthlyAmount);

    // Create contract
    const contract = await prisma.contract.create({
      data: {
        borrower_user_id: userId,
        total_amount: totalAmount,
        currency,
        monthly_amount: monthlyAmount,
        n_months: nMonths,
        start_date: new Date(),
        description: description || null,
        language: language || 'en',
        status: 'pending_lender',
        
        participants: {
          create: [
            {
              role: 'borrower',
              first_name: borrower.firstName,
              last_name: borrower.lastName,
              patronymic: borrower.patronymic,
              telegram_username: borrower.username,
              phone: borrower.phone,
              address: borrower.address,
              confirmed_at: new Date(),
              confirmed_by_user_id: userId,
            },
            {
              role: 'lender',
              invite_token: generateInviteToken(),
              first_name: lender.firstName,
              last_name: lender.lastName,
              patronymic: lender.patronymic,
              telegram_username: lender.username,
              phone: lender.phone,
              address: lender.address,
            },
            // Map optional witnesses
            ...(witnesses || []).map((w: any, index: number) => ({
              role: `witness${index + 1}`,
              invite_token: generateInviteToken(),
              first_name: w.firstName,
              last_name: w.lastName,
              telegram_username: w.username,
            }))
          ]
        }
      },
      include: {
        participants: true
      }
    });

    // Return the contract and invite tokens to the borrower
    const inviteTokens = contract.participants
      .filter(p => p.role !== 'borrower')
      .map(p => ({
        role: p.role,
        link: `${process.env.MINI_APP_URL}?startapp=${contract.uuid}_${p.role}_${p.invite_token}`
      }));

    res.json({ uuid: contract.uuid, inviteTokens });

  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts/:uuid/photo - Upload selfie
router.post('/:uuid/photo', authenticateJWT, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const { uuid } = req.params;
    const { role } = req.body;
    
    if (!req.file || !role) {
      res.status(400).json({ error: 'Missing file or role' });
      return;
    }

    const storagePath = process.env.STORAGE_PATH || './storage';
    const dir = path.join(storagePath, 'contracts', uuid, 'photos');
    
    // Ensure directory exists
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }

    // In a real app, we'd use sharp here to resize and validate image format
    // For this mock, we just write the buffer directly
    const photoPath = path.join(dir, `${role}.jpg`);
    fs.writeFileSync(photoPath, req.file.buffer);

    // Update participant record
    await prisma.participant.updateMany({
      where: { contract_uuid: uuid, role },
      data: { photo_path: photoPath }
    });

    res.json({ success: true, path: photoPath });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
