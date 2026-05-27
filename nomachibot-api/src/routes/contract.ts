import { generateContractPdf } from '../services/pdf.service';
import express, { Request, Response } from 'express';
import { authenticateJWT, optionalAuthenticateJWT, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Import bot lazily to avoid circular dependency at startup
let _bot: import('telegraf').Telegraf | null = null;
async function getBot() {
  if (!_bot) {
    const mod = await import('../index');
    _bot = mod.bot;
  }
  return _bot;
}

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

const generateInviteToken = () => crypto.randomBytes(32).toString('hex');

function buildSchedule(totalAmount: number, monthlyAmount: number, startDate: Date) {
  const nMonths = Math.ceil(totalAmount / monthlyAmount);
  const schedule = [];
  let remaining = totalAmount;
  for (let i = 1; i <= nMonths; i++) {
    const isLast = i === nMonths;
    const amount = isLast ? remaining : monthlyAmount;
    remaining = isLast ? 0 : +(remaining - monthlyAmount).toFixed(2);
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    schedule.push({ month: i, dueDate, amount: +amount.toFixed(2), balance: remaining });
  }
  return schedule;
}

// POST /api/contracts - Create draft contract (borrower only)
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { totalAmount, monthlyAmount, currency, description, language, startDate, borrower, lender, witnesses } = req.body;

    if (!totalAmount || !monthlyAmount || !lender?.username || !lender?.firstName || !lender?.lastName) {
      res.status(400).json({ error: 'Missing mandatory fields' });
      return;
    }
    if (monthlyAmount <= 0 || totalAmount <= 0) {
      res.status(400).json({ error: 'Amounts must be positive' });
      return;
    }

    const nMonths = Math.ceil(totalAmount / monthlyAmount);
    const contractStartDate = startDate ? new Date(startDate) : new Date();

    const contract = await prisma.contract.create({
      data: {
        borrower_user_id: userId,
        total_amount: totalAmount,
        currency: currency || 'UZS',
        monthly_amount: monthlyAmount,
        n_months: nMonths,
        start_date: contractStartDate,
        description: description || null,
        language: language || 'en',
        status: 'pending_lender',
        participants: {
          create: [
            {
              role: 'borrower',
              first_name: borrower.firstName,
              last_name: borrower.lastName,
              patronymic: borrower.patronymic || null,
              telegram_username: borrower.username,
              phone: borrower.phone || null,
              address: borrower.address || null,
              confirmed_at: new Date(),
              confirmed_by_user_id: userId,
            },
            {
              role: 'lender',
              invite_token: generateInviteToken(),
              first_name: lender.firstName,
              last_name: lender.lastName,
              patronymic: lender.patronymic || null,
              telegram_username: lender.username,
              phone: lender.phone || null,
              address: lender.address || null,
            },
            ...(witnesses || []).map((w: any, index: number) => ({
              role: `witness${index + 1}`,
              invite_token: generateInviteToken(),
              first_name: w.firstName,
              last_name: w.lastName,
              patronymic: w.patronymic || null,
              telegram_username: w.username,
            })),
          ],
        },
      },
      include: { participants: true },
    });

    const inviteTokens = contract.participants
      .filter(p => p.role !== 'borrower')
      .map(p => ({
        role: p.role,
        link: `${process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || process.env.MINI_APP_URL}/confirm/${contract.uuid}/${p.role}/${p.invite_token}`,
      }));

    res.json({ uuid: contract.uuid, inviteTokens });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts - List all contracts for current user
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId: string = req.user.id;

    const borrowing = await prisma.contract.findMany({
      where: { borrower_user_id: userId },
      include: { participants: { select: { role: true, first_name: true, last_name: true } } },
      orderBy: { created_at: 'desc' },
    });

    const asParticipant = await prisma.participant.findMany({
      where: { confirmed_by_user_id: userId, role: { not: 'borrower' } },
      include: {
        contract: {
          include: { participants: { select: { role: true, first_name: true, last_name: true } } },
        },
      },
    });

    const lending = asParticipant
      .filter((p: any) => p.role === 'lender')
      .map((p: any) => ({ ...p.contract, myRole: 'lender' }));

    const witnessing = asParticipant
      .filter((p: any) => p.role.startsWith('witness'))
      .map((p: any) => ({ ...p.contract, myRole: p.role }));

    res.json({
      borrowing: borrowing.map((c: any) => ({ ...c, myRole: 'borrower' })),
      lending,
      witnessing,
    });
  } catch (error) {
    console.error('Error listing contracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts/:uuid/preview - Public preview (invite token required, no JWT)
router.get('/:uuid/preview', async (req: Request, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const token = req.query['token'] as string;
    const role = req.query['role'] as string;

    if (!token || !role) {
      res.status(400).json({ error: 'token and role are required' });
      return;
    }

    const participant = await prisma.participant.findFirst({
      where: { contract_uuid: uuid, role, invite_token: token },
    });

    if (!participant) {
      res.status(403).json({ error: 'Invalid or expired invite token' });
      return;
    }

    const contract = await prisma.contract.findUnique({
      where: { uuid },
      include: {
        participants: {
          select: {
            role: true,
            first_name: true,
            last_name: true,
            patronymic: true,
            telegram_username: true,
            confirmed_at: true,
          },
        },
      },
    });

    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const schedule = buildSchedule(
      Number(contract.total_amount),
      Number(contract.monthly_amount),
      contract.start_date,
    );

    res.json({
      uuid: contract.uuid,
      status: contract.status,
      total_amount: contract.total_amount,
      monthly_amount: contract.monthly_amount,
      currency: contract.currency,
      n_months: contract.n_months,
      start_date: contract.start_date,
      description: contract.description,
      language: contract.language,
      participants: contract.participants,
      schedule,
      participantData: {
        first_name: participant.first_name,
        last_name: participant.last_name,
        patronymic: participant.patronymic,
        telegram_username: participant.telegram_username,
        phone: participant.phone,
        address: participant.address,
        already_confirmed: !!participant.confirmed_at,
      },
    });
  } catch (error) {
    console.error('Error fetching contract preview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts/:uuid - Full contract details (authenticated participants only)
router.get('/:uuid', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const userId: string = req.user.id;

    const contract = await prisma.contract.findUnique({
      where: { uuid },
      include: {
        participants: true,
        payments: { orderBy: { payment_date: 'asc' } },
      },
    });

    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const isParticipant =
      contract.borrower_user_id === userId ||
      contract.participants.some((p: any) => p.confirmed_by_user_id === userId);

    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts/:uuid/lender-confirm - Lender confirms the contract
router.post('/:uuid/lender-confirm', optionalAuthenticateJWT, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const userId: string | undefined = req.user?.id;
    const { token, firstName, lastName, patronymic, phone, address } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Invite token is required' });
      return;
    }

    const participant = await prisma.participant.findFirst({
      where: { contract_uuid: uuid, role: 'lender', invite_token: token as string },
    });

    if (!participant) {
      res.status(403).json({ error: 'Invalid or expired invite token' });
      return;
    }

    if (participant.confirmed_at) {
      res.status(409).json({ error: 'This invite link has already been used' });
      return;
    }

    let photoPath: string | null = null;
    if (req.file) {
      const storagePath = process.env.STORAGE_PATH || './storage';
      const dir = path.join(storagePath, 'contracts', uuid, 'photos');
      fs.mkdirSync(dir, { recursive: true });
      photoPath = path.join(dir, 'lender.jpg');
      fs.writeFileSync(photoPath, req.file.buffer);
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        first_name: firstName || participant.first_name,
        last_name: lastName || participant.last_name,
        patronymic: patronymic || participant.patronymic,
        phone: phone || participant.phone,
        address: address || participant.address,
        photo_path: photoPath || participant.photo_path,
        confirmed_at: new Date(),
        confirmed_by_user_id: userId ?? null,
      },
    });

    await prisma.contract.update({
      where: { uuid },
      data: { status: 'active', activated_at: new Date() },
    });

    generateContractPdf(uuid).catch(err => console.error('PDF generation failed:', err));

    const publicUrl = `${process.env.PUBLIC_BASE_URL || ''}/public/status/${uuid}`;
    res.json({ success: true, publicUrl });
  } catch (error) {
    console.error('Error confirming lender:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts/:uuid/witness-confirm/:n - Witness n confirms (non-blocking)
router.post('/:uuid/witness-confirm/:n', optionalAuthenticateJWT, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const n = req.params['n'] as string;
    const userId: string = req.user.id;
    const { token, firstName, lastName, patronymic, phone, address } = req.body;

    const witnessIndex = parseInt(n, 10);
    if (isNaN(witnessIndex) || witnessIndex < 1 || witnessIndex > 3) {
      res.status(400).json({ error: 'Witness index must be 1, 2, or 3' });
      return;
    }

    if (!token) {
      res.status(400).json({ error: 'Invite token is required' });
      return;
    }

    const role = `witness${witnessIndex}`;

    const participant = await prisma.participant.findFirst({
      where: { contract_uuid: uuid, role, invite_token: token as string },
    });

    if (!participant) {
      res.status(403).json({ error: 'Invalid or expired invite token' });
      return;
    }

    if (participant.confirmed_at) {
      res.status(409).json({ error: 'This invite link has already been used' });
      return;
    }

    let photoPath: string | null = null;
    if (req.file) {
      const storagePath = process.env.STORAGE_PATH || './storage';
      const dir = path.join(storagePath, 'contracts', uuid, 'photos');
      fs.mkdirSync(dir, { recursive: true });
      photoPath = path.join(dir, `${role}.jpg`);
      fs.writeFileSync(photoPath, req.file.buffer);
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        first_name: firstName || participant.first_name,
        last_name: lastName || participant.last_name,
        patronymic: patronymic || participant.patronymic,
        phone: phone || participant.phone,
        address: address || participant.address,
        photo_path: photoPath || participant.photo_path,
        confirmed_at: new Date(),
        confirmed_by_user_id: userId,
      },
    });

    // Witness confirmation does NOT change contract status
    generateContractPdf(uuid).catch(err => console.error('PDF generation failed:', err));

    const publicUrl = `${process.env.PUBLIC_BASE_URL || ''}/public/status/${uuid}`;
    res.json({ success: true, publicUrl });
  } catch (error) {
    console.error('Error confirming witness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts/:uuid/photo - Upload selfie for authenticated user
router.post('/:uuid/photo', authenticateJWT, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const { role } = req.body;

    if (!req.file || !role) {
      res.status(400).json({ error: 'Missing file or role' });
      return;
    }

    const storagePath = process.env.STORAGE_PATH || './storage';
    const dir = path.join(storagePath, 'contracts', uuid, 'photos');
    fs.mkdirSync(dir, { recursive: true });

    const photoPath = path.join(dir, `${role}.jpg`);
    fs.writeFileSync(photoPath, req.file.buffer);

    await prisma.participant.updateMany({
      where: { contract_uuid: uuid, role },
      data: { photo_path: photoPath },
    });

    res.json({ success: true, path: photoPath });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts/:uuid/payments - Lender logs a repayment received
router.post('/:uuid/payments', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const userId: string = req.user.id;
    const { amount, paymentDate, note } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Amount must be positive' });
      return;
    }

    const lenderParticipant = await prisma.participant.findFirst({
      where: { contract_uuid: uuid, role: 'lender', confirmed_by_user_id: userId },
    });

    if (!lenderParticipant) {
      res.status(403).json({ error: 'Only the lender can log payments' });
      return;
    }

    const contract = await prisma.contract.findUnique({
      where: { uuid },
      include: { payments: { orderBy: { payment_date: 'asc' } } },
    });

    if (!contract || contract.status !== 'active') {
      res.status(400).json({ error: 'Contract must be active to log payments' });
      return;
    }

    const totalPaid = contract.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const runningBalance = Number(contract.total_amount) - totalPaid - Number(amount);

    const payment = await prisma.payment.create({
      data: {
        contract_uuid: uuid,
        logged_by_user_id: userId,
        amount,
        payment_date: paymentDate ? new Date(paymentDate) : new Date(),
        note: note || null,
        running_balance: runningBalance,
      },
    });

    const settled = runningBalance <= 0;
    if (settled) {
      await prisma.contract.update({ where: { uuid }, data: { status: 'settled' } });
    }

    // Notify borrower via Telegram bot
    try {
      const borrowerUser = await prisma.user.findUnique({
        where: { id: contract.borrower_user_id },
        select: { telegram_id: true },
      });
      if (borrowerUser?.telegram_id) {
        const tgBot = await getBot();
        const msg = settled
          ? `✅ *Contract settled!*\n\nAll payments for contract \`${uuid.slice(0, 8)}\` have been received. The contract is now closed.`
          : `💰 *Payment received*\n\nAmount: *${Number(amount).toLocaleString()} ${contract.currency}*\nRemaining balance: *${Math.max(0, runningBalance).toLocaleString()} ${contract.currency}*\n\nContract: \`${uuid.slice(0, 8)}\``;
        await tgBot.telegram.sendMessage(Number(borrowerUser.telegram_id), msg, { parse_mode: 'Markdown' });
      }
    } catch (notifyErr) {
      console.warn('Failed to send payment notification:', notifyErr);
      // Non-fatal — payment is already saved
    }

    res.json({ payment, runningBalance, settled });
  } catch (error) {
    console.error('Error logging payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts/:uuid/payments - Payment history (authenticated participants)
router.get('/:uuid/payments', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const userId: string = req.user.id;

    const contract = await prisma.contract.findUnique({ where: { uuid } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const isParticipant =
      contract.borrower_user_id === userId ||
      (await prisma.participant.findFirst({
        where: { contract_uuid: uuid, confirmed_by_user_id: userId },
      })) !== null;

    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const payments = await prisma.payment.findMany({
      where: { contract_uuid: uuid },
      orderBy: { payment_date: 'asc' },
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
