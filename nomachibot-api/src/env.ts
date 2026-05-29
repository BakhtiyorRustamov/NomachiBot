import 'dotenv/config';

/**
 * Required environment variables. The server refuses to start if any of
 * these are missing. Fails fast > silently misbehaving in production.
 *
 * Add new keys here as soon as code starts depending on them — never read
 * a required value via `process.env.X` without first listing it below.
 */
const REQUIRED = [
  'DATABASE_URL',
  'BOT_TOKEN',
  'JWT_SECRET',
] as const;

/**
 * Strongly recommended in production. Missing values trigger a warning,
 * not a crash, so local development still works. Production deployments
 * should set all of these.
 */
const RECOMMENDED = [
  'FRONTEND_URL',  // Vercel origin — needed for QR code / public link URLs
  'MINI_APP_URL',  // Telegram Mini App URL for /start invite buttons
  'STORAGE_PATH',  // Absolute path for selfies and generated PDFs
] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter(k => !process.env[k] || process.env[k]!.trim() === '');
  if (missing.length > 0) {
    console.error(
      `\n[startup] Missing required environment variables:\n  - ${missing.join('\n  - ')}\n` +
      `Set these in your .env file (see .env.example) and restart.\n`,
    );
    process.exit(1);
  }

  // JWT secret length sanity check — anything < 32 chars is brute-forceable.
  if ((process.env.JWT_SECRET || '').length < 32) {
    console.error(
      '\n[startup] JWT_SECRET is too short (< 32 chars). Generate one with:\n' +
      '  openssl rand -hex 32\n',
    );
    process.exit(1);
  }

  const softMissing = RECOMMENDED.filter(k => !process.env[k] || process.env[k]!.trim() === '');
  if (softMissing.length > 0) {
    console.warn(
      `[startup] Recommended env vars not set (production may misbehave): ${softMissing.join(', ')}`,
    );
  }
}

/**
 * Strict accessor — throws if the variable is missing at call time. Use
 * this anywhere code reads an env var so failures surface immediately
 * rather than producing a string containing "undefined".
 */
export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return v;
}
