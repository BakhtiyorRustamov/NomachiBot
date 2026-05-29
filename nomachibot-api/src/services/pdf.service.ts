import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';

// ── Semaphore: max 2 concurrent PDF jobs ─────────────────────────────────────
let activeJobs = 0;
const MAX_CONCURRENT = 2;
const queue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  return new Promise(resolve => {
    if (activeJobs < MAX_CONCURRENT) { activeJobs++; resolve(); }
    else { queue.push(() => { activeJobs++; resolve(); }); }
  });
}
function releaseSemaphore() {
  activeJobs--;
  if (queue.length > 0) { const next = queue.shift()!; next(); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number | string): string {
  return Number(n).toLocaleString('en-US');
}

function buildSchedule(total: number, monthly: number, startDate: Date) {
  const n = Math.ceil(total / monthly);
  const rows = [];
  let bal = total;
  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    const amt = isLast ? +bal.toFixed(2) : monthly;
    bal = isLast ? 0 : +(bal - monthly).toFixed(2);
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + i);
    rows.push({ month: i, due: fmtDate(due), amount: amt, balance: Math.max(0, bal) });
  }
  return rows;
}

function getRoleLabel(role: string): string {
  const m: Record<string, string> = {
    borrower: 'Borrower', lender: 'Lender',
    witness1: 'Witness 1', witness2: 'Witness 2', witness3: 'Witness 3',
  };
  return m[role] ?? role;
}

// ── Draw a simple horizontal line ─────────────────────────────────────────────
function hline(doc: PDFKit.PDFDocument, y: number, color = '#e5e7eb') {
  doc.save().strokeColor(color).moveTo(40, y).lineTo(555, y).stroke().restore();
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function generateContractPdf(uuid: string): Promise<string> {
  await acquireSemaphore();
  try {
    const contract = await prisma.contract.findUnique({
      where: { uuid },
      include: {
        participants: { orderBy: { role: 'asc' } },
        payments: { orderBy: { payment_date: 'asc' } },
      },
    });
    if (!contract) throw new Error(`Contract ${uuid} not found`);

    // The QR code must point at the React public status page (frontend / Vercel),
    // NOT the backend API. Prefer FRONTEND_URL; PUBLIC_BASE_URL is the API host on Render.
    const publicBaseUrl =
      process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || 'https://nomachi-bot.vercel.app';

    // QR code as PNG buffer
    const qrBuffer: Buffer = await QRCode.toBuffer(
      `${publicBaseUrl}/status/${uuid}`,
      { type: 'png', width: 120, margin: 1 },
    );

    // Output path
    const storagePath = process.env.STORAGE_PATH ?? './storage';
    const dir = path.join(storagePath, 'contracts', uuid);
    fs.mkdirSync(dir, { recursive: true });
    const pdfPath = path.join(dir, 'agreement.pdf');

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      stream.on('error', reject);
      stream.on('finish', resolve);

      const W = 515; // usable width (595 - 2*40)
      const ACCENT = '#2563eb'; // blue
      const GRAY   = '#6b7280';
      const LIGHT  = '#f3f4f6';

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc.rect(0, 0, 595, 56).fill(ACCENT);
      doc.fill('#ffffff').fontSize(18).font('Helvetica-Bold').text('NomachiBot', 40, 18);
      doc.fill('#93c5fd').fontSize(9).font('Helvetica').text('Debt Agreement', 40, 40);
      doc.fill('#ffffff').fontSize(9).font('Helvetica')
        .text(`ID: ${uuid}`, 40, 40, { align: 'right', width: W });
      doc.y = 70;

      // ── CONTRACT SUMMARY ─────────────────────────────────────────────────────
      doc.fill('#111827').fontSize(13).font('Helvetica-Bold').text('Contract Summary', 40, doc.y);
      doc.moveDown(0.4);
      hline(doc, doc.y);
      doc.moveDown(0.4);

      const fields: [string, string][] = [
        ['Total Amount', `${fmtMoney(Number(contract.total_amount))} ${contract.currency}`],
        ['Monthly Payment', `${fmtMoney(Number(contract.monthly_amount))} ${contract.currency}`],
        ['Duration', `${contract.n_months} month${contract.n_months !== 1 ? 's' : ''}`],
        ['Start Date', fmtDate(contract.start_date)],
        ['Status', String(contract.status).toUpperCase()],
        ['Created', fmtDate(contract.created_at)],
      ];

      const col1 = 40, col2 = 220, colW = 130;
      let fy = doc.y;
      fields.forEach(([label, val], i) => {
        const x = i % 2 === 0 ? col1 : col2 + colW;
        if (i % 2 === 0 && i > 0) fy += 22;
        doc.fill(GRAY).fontSize(8).font('Helvetica').text(label, x, fy);
        doc.fill('#111827').fontSize(10).font('Helvetica-Bold').text(val, x, fy + 10, { width: colW + 60 });
      });
      doc.y = fy + 34;

      if (contract.description) {
        doc.moveDown(0.3);
        doc.fill(GRAY).fontSize(8).font('Helvetica-Oblique')
          .text(`"${contract.description}"`, 40, doc.y, { width: W });
        doc.moveDown(0.4);
      }

      // ── PARTICIPANTS ─────────────────────────────────────────────────────────
      doc.moveDown(0.6);
      doc.fill('#111827').fontSize(13).font('Helvetica-Bold').text('Participants', 40, doc.y);
      doc.moveDown(0.4);
      hline(doc, doc.y);
      doc.moveDown(0.4);

      const ROLE_ORDER = ['borrower', 'lender', 'witness1', 'witness2', 'witness3'];
      const sorted = [...contract.participants].sort(
        (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
      );

      sorted.forEach(p => {
        const startY = doc.y;
        doc.rect(40, startY, W, 52).fill(LIGHT);

        // Role badge
        doc.rect(40, startY, 80, 52).fill(ACCENT);
        doc.fill('#ffffff').fontSize(8).font('Helvetica-Bold')
          .text(getRoleLabel(p.role), 44, startY + 20, { width: 72, align: 'center' });

        // Details
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
        doc.fill('#111827').fontSize(10).font('Helvetica-Bold').text(name, 130, startY + 8);
        if (p.telegram_username) {
          doc.fill(ACCENT).fontSize(8).font('Helvetica').text(`@${p.telegram_username}`, 130, startY + 22);
        }
        if (p.phone) {
          doc.fill(GRAY).fontSize(8).font('Helvetica').text(p.phone, 130, startY + 33);
        }

        // Confirmed badge
        const confirmedText = p.confirmed_at
          ? `✓ Confirmed ${fmtDate(p.confirmed_at)}`
          : '⏳ Pending';
        const badgeColor = p.confirmed_at ? '#16a34a' : '#ca8a04';
        doc.fill(badgeColor).fontSize(8).font('Helvetica-Bold')
          .text(confirmedText, 370, startY + 20, { width: 180 });

        doc.y = startY + 58;
      });

      // ── REPAYMENT SCHEDULE ───────────────────────────────────────────────────
      doc.addPage();
      doc.fill('#111827').fontSize(13).font('Helvetica-Bold').text('Repayment Schedule', 40, 40);
      doc.moveDown(0.4);
      hline(doc, doc.y);
      doc.moveDown(0.4);

      const schedule = buildSchedule(
        Number(contract.total_amount),
        Number(contract.monthly_amount),
        contract.start_date,
      );

      // Table header
      const tCols = [40, 80, 230, 370, 460];
      doc.rect(40, doc.y, W, 18).fill(ACCENT);
      doc.fill('#ffffff').fontSize(8).font('Helvetica-Bold');
      ['#', 'Due Date', `Amount (${contract.currency})`, `Balance (${contract.currency})`].forEach((h, i) => {
        doc.text(h, tCols[i] + 4, doc.y - 14, { width: tCols[i + 1] - tCols[i] - 4 });
      });
      doc.y += 4;

      schedule.forEach((row, i) => {
        if (doc.y > 750) { doc.addPage(); }
        const rowY = doc.y;
        if (i % 2 === 0) doc.rect(40, rowY, W, 16).fill('#f9fafb');
        doc.fill('#374151').fontSize(8).font('Helvetica');
        [String(row.month), row.due, fmtMoney(row.amount), fmtMoney(row.balance)].forEach((val, ci) => {
          doc.text(val, tCols[ci] + 4, rowY + 4, { width: tCols[ci + 1] - tCols[ci] - 4 });
        });
        doc.y = rowY + 16;
      });

      // ── PAYMENT HISTORY ──────────────────────────────────────────────────────
      if (contract.payments.length > 0) {
        doc.moveDown(1);
        if (doc.y > 700) doc.addPage();
        doc.fill('#111827').fontSize(13).font('Helvetica-Bold').text('Payment History', 40, doc.y);
        doc.moveDown(0.4);
        hline(doc, doc.y);
        doc.moveDown(0.4);

        // Header
        const pCols = [40, 80, 210, 330, 440];
        doc.rect(40, doc.y, W, 18).fill(ACCENT);
        doc.fill('#ffffff').fontSize(8).font('Helvetica-Bold');
        ['#', 'Date', `Amount (${contract.currency})`, 'Note', `Balance (${contract.currency})`].forEach((h, i) => {
          doc.text(h, pCols[i] + 4, doc.y - 14, { width: pCols[i + 1] - pCols[i] - 4 });
        });
        doc.y += 4;

        contract.payments.forEach((p, i) => {
          if (doc.y > 750) doc.addPage();
          const rowY = doc.y;
          if (i % 2 === 0) doc.rect(40, rowY, W, 16).fill('#f9fafb');
          doc.fill('#374151').fontSize(8).font('Helvetica');
          [
            String(i + 1),
            fmtDate(p.payment_date),
            fmtMoney(Number(p.amount)),
            p.note ?? '',
            fmtMoney(Math.max(0, Number(p.running_balance))),
          ].forEach((val, ci) => {
            doc.text(val, pCols[ci] + 4, rowY + 4, { width: pCols[ci + 1] - pCols[ci] - 4 });
          });
          doc.y = rowY + 16;
        });
      }

      // ── FOOTER with QR ───────────────────────────────────────────────────────
      doc.moveDown(1.5);
      if (doc.y > 660) doc.addPage();

      hline(doc, doc.y);
      doc.moveDown(0.5);

      // QR code
      doc.image(qrBuffer, 40, doc.y, { width: 80, height: 80 });

      doc.fill(GRAY).fontSize(8).font('Helvetica')
        .text('Scan to view live contract status', 130, doc.y + 4)
        .text(`${publicBaseUrl}/status/${uuid}`, 130, doc.y + 16, { link: `${publicBaseUrl}/status/${uuid}` });

      doc.fill('#9ca3af').fontSize(7)
        .text(
          `Generated by NomachiBot on ${fmtDate(new Date())}. This document is a record of a P2P debt agreement.`,
          130, doc.y + 30, { width: W - 90 },
        );

      doc.end();
    });

    // Save path to DB
    await prisma.contract.update({ where: { uuid }, data: { pdf_path: pdfPath } });

    return pdfPath;
  } finally {
    releaseSemaphore();
  }
}
