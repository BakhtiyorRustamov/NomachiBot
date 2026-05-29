/**
 * Selfie upload validation.
 *
 * Trusting `req.file.mimetype` is unsafe — multer sets it from the
 * Content-Type header sent by the client, which any attacker can forge.
 * We re-derive the MIME type by reading the first few bytes (the file's
 * "magic number") via the `file-type` package. Anything that doesn't
 * match an allowed image format is rejected.
 *
 * `file-type` v22 is ESM-only, so it's imported dynamically here to keep
 * the rest of the codebase on CommonJS.
 */

export const ALLOWED_PHOTO_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — also enforced in multer limits

export interface ValidatedPhoto {
  ok: true;
  buffer: Buffer;
  mime: string;
  ext: string;
}

export interface PhotoValidationError {
  ok: false;
  status: number;
  error: string;
}

export async function validatePhotoUpload(
  file: { buffer?: Buffer; size?: number } | undefined,
): Promise<ValidatedPhoto | PhotoValidationError> {
  if (!file || !file.buffer) {
    return { ok: false, status: 400, error: 'No photo uploaded' };
  }
  if (file.size !== undefined && file.size > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, error: 'Photo exceeds 5 MB limit' };
  }

  // Dynamic import because file-type v22 is ESM-only.
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || !ALLOWED_PHOTO_MIME.has(detected.mime)) {
    return {
      ok: false,
      status: 415,
      error: 'Unsupported image format. Allowed: JPEG, PNG, WebP.',
    };
  }

  return { ok: true, buffer: file.buffer, mime: detected.mime, ext: detected.ext };
}
