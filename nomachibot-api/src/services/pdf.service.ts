import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import Handlebars from 'handlebars';
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
    if (activeJobs < MAX_CONCURRENT) {
      activeJobs++;
      resolve();
    } else {
      queue.push(() => { activeJobs++; resolve(); });
    }
  });
}

function releaseSemaphore() {
  activeJobs--;
  if (queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

// ── i18n label loader ─────────────────────────────────────────────────────────
function loadLabels(lang: string): Record<string, string> {
  const supported = ['en', 'uz', 'ru'];
  const l = supported.includes(lang) ? lang : 'en';
  const filePath = path.resolve(__dirname, '../i18n', `${l}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    const fallback = path.resolve(__dirname, '../i18n/en.json');
    return JSON.parse(fs.readFileSync(fallback, 'utf-8'));
  }
}

// ── Role label helper ─────────────────────────────────────────────────────────
function getRoleLabel(role: string, labels: Record<string, string>): string {
  const map: Record<string, string> = {
    borrower: labels['borrower'] ?? 'Borrower',
    lender: labels['lender'] ?? 'Lender',
    witness1: labels['witness1'] ?? 'Witness 1',
    witness2: labels['witness2'] ?? 'Witness 2',
    witness3: labels['witness3'] ?? 'Witness 3',
  };
  return map[role] ?? role;
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}

// ── Load Handlebars template (compiled once, cached) ─────────────────────────
let compiledTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (!compiledTemplate) {
    const tplPath = path.resolve(__dirname, '../templates/contract.hbs');
    const source = fs.readFileSync(tplPath, 'utf-8');
    compiledTemplate = Handlebars.compile(source);
  }
  return compiledTemplate;
}

// ── Photo → base64 data URL ───────────────────────────────────────────────────
function photoToDataUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  try {
    const buf = fs.readFileSync(photoPath);
    return 'data:image/jpeg;base64,' + buf.toString('base64');
  } catch {
    return null;
  }
}

// ── Build repayment schedule ──────────────────────────────────────────────────
function buildSchedule(totalAmount: number, monthlyAmount: number, startDate: Date, currency: string) {
  const nMonths = Math.ceil(totalAmount / monthlyAmount);
  const rows = [];
  let remaining = totalAmount;
  for (let i = 1; i <= nMonths; i++) {
    const isLast = i === nMonths;
    const amount = isLast ? +remaining.toFixed(2) : monthlyAmount;
    remaining = isLast ? 0 : +(remaining - monthlyAmount).toFixed(2);
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    rows.push({
      month: i,
      dueDate: fmtDate(dueDate),
      amount: amount.toLocaleString(),
      balance: Math.max(0, remaining).toLocaleString(),
    });
  }
  return rows;
}

// ── Main: generate PDF for a contract ────────────────────────────────────────
export async function generateContractPdf(uuid: string): Promise<string> {
  await acquireSemaphore();

  try {
    // 1. Load contract with all relations
    const contract = await prisma.contract.findUnique({
      where: { uuid },
      include: {
        participants: { orderBy: { role: 'asc' } },
        payments: { orderBy: { payment_date: 'asc' } },
      },
    });

    if (!contract) throw new Error(`Contract ${uuid} not found`);

    const labels = loadLabels(contract.language);
    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'https://yourdomain.com';

    // 2. QR code as base64 data URL
    const qrUrl = `${publicBaseUrl}/public/status/${uuid}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 2 });

    // 3. Participant blocks
    const ROLE_ORDER = ['borrower', 'lender', 'witness1', 'witness2', 'witness3'];
    const sortedParticipants = [...contract.participants].sort(
      (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
    );

    const participantData = sortedParticipants.map(p => ({
      roleLabel: getRoleLabel(p.role, labels),
      fullName: `${p.first_name} ${p.last_name}`,
      patronymic: p.patronymic,
      telegram_username: p.telegram_username,
      phone: p.phone,
      address: p.address,
      confirmed_at: p.confirmed_at ? fmtDate(p.confirmed_at) : null,
      photoDataUrl: photoToDataUrl(p.photo_path),
    }));

    // 4. Payment rows
    const paymentData = contract.payments.map((p, i) => ({
      index: i + 1,
      payment_date: fmtDate(p.payment_date),
      amount: Number(p.amount).toLocaleString(),
      note: p.note ?? '',
      running_balance: Math.max(0, Number(p.running_balance)).toLocaleString(),
    }));

    // 5. Schedule
    const schedule = buildSchedule(
      Number(contract.total_amount),
      Number(contract.monthly_amount),
      contract.start_date,
      contract.currency,
    );

    // 6. Render template
    const template = getTemplate();
    const html = template({
      lang: contract.language,
      labels,
      uuid,
      createdOn: fmtDate(contract.created_at),
      totalAmount: Number(contract.total_amount).toLocaleString(),
      monthlyAmount: Number(contract.monthly_amount).toLocaleString(),
      currency: contract.currency,
      nMonths: contract.n_months,
      startDate: fmtDate(contract.start_date),
      description: contract.description,
      schedule,
      participants: participantData,
      payments: paymentData,
      qrDataUrl,
    });

    // 7. Puppeteer → PDF
    const storagePath = process.env.STORAGE_PATH ?? './storage';
    const dir = path.join(storagePath, 'contracts', uuid);
    fs.mkdirSync(dir, { recursive: true });

    const pdfPath = path.join(dir, 'agreement.pdf');

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
      || await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      executablePath,
      headless: chromium.headless,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0