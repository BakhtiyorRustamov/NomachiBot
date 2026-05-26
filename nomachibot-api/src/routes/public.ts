import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { generateContractPdf } from '../services/pdf.service';

const router = express.Router();

// Rate limit: 120 requests/hr per IP for public endpoints
const publicRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ── GET /public/status/:uuid ─ Full public contract data (no auth) ────────────
router.get('/status/:uuid', publicRateLimit, async (req: Request, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;

    const contract = await prisma.contract.findUnique({
      where: { uuid },
      include: {
        participants: {
          orderBy: { role: 'asc' },
        },
        payments: {
          orderBy: { payment_date: 'asc' },
        },
      },
    });

    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    const totalPaid = contract.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(contract.total_amount) - totalPaid;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? '';

    // Strip internal file paths from participants before sending
    const participants = contract.participants.map(p => ({
      role: p.role,
      first_name: p.first_name,
      last_name: p.last_name,
      patronymic: p.patronymic,
      telegram_username: p.telegram_username,
      phone: p.phone,
      address: p.address,
      confirmed_at: p.confirmed_at,
      photo_url: p.photo_path
        ? `${publicBaseUrl}/public/photos/${uuid}/${p.role}`
        : null,
    }));

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
      created_at: contract.created_at,
      activated_at: contract.activated_at,
      participants,
      payments: contract.payments.map((p, i) => ({
        index: i + 1,
        payment_date: p.payment_date,
        amount: p.amount,
        note: p.note,
        running_balance: p.running_balance,
        logged_at: p.logged_at,
      })),
      summary: {
        total_amount: contract.total_amount,
        total_paid: totalPaid,
        remaining: Math.max(0, remaining),
        months_total: contract.n_months,
        payments_count: contract.payments.length,
      },
    });
  } catch (error) {
    console.error('Error fetching public status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /public/status/:uuid/pdf ─ Regenerate + download PDF ─────────────────
router.get('/status/:uuid/pdf', publicRateLimit, async (req: Request, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;

    const contract = await prisma.contract.findUnique({ where: { uuid } });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    // Always regenerate to capture latest payment history
    const pdfPath = await generateContractPdf(uuid);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shortUuid = uuid.slice(0, 8);
    const filename = `nomachi_${shortUuid}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (error) {
    console.error('Error generating public PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ── GET /public/photos/:uuid/:role ─ Serve participant selfie ────────────────
router.get('/photos/:uuid/:role', async (req: Request, res: Response) => {
  try {
    const uuid = req.params['uuid'] as string;
    const role = req.params['role'] as string;

    const participant = await prisma.participant.findFirst({
      where: { contract_uuid: uuid, role },
      select: { photo_path: true },
    });

    if (!participant?.photo_path) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    if (!fs.existsSync(participant.photo_path)) {
      res.status(404).json({ error: 'Photo file missing' });
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(participant.photo_path).pipe(res);
  } catch (error) {
    console.error('Error serving photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
