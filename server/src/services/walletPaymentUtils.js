// Wallet-transfer payment helpers — pure functions with no I/O so the
// validation logic can be unit-tested without mocking the database.

export const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024

// Known-good defaults used only when WALLET_CONFIG is unset; they carry no
// numbers on purpose — getWalletMethods() reports configured:false until the
// operator provides real receiving numbers via the WALLET_CONFIG env var, so
// a placeholder number can never be shown to a customer.
const WALLET_METHOD_IDS = ['vodafone_cash', 'instapay', 'orange_money', 'etisalat_cash']

function cleanString(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Parse the WALLET_CONFIG env var (JSON array of receiving numbers).
 * Returns { configured, methods }. configured:false means the operator has
 * not supplied real numbers yet — callers must hide the payment flow.
 */
export function getWalletMethods(rawEnv = process.env) {
  const raw = rawEnv.WALLET_CONFIG
  if (!raw) return { configured: false, methods: [] }
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { configured: false, methods: [] }
    const methods = parsed
      .filter((m) => m && typeof m === 'object')
      .map((m) => ({
        id: cleanString(m.id, 40).toLowerCase(),
        name: cleanString(m.name, 60),
        name_ar: cleanString(m.name_ar, 60),
        number: cleanString(m.number, 64),
      }))
      .filter((m) => /^[a-z0-9_]{2,40}$/.test(m.id) && m.name && m.number)
    if (!methods.length) return { configured: false, methods: [] }
    return { configured: true, methods }
  } catch {
    return { configured: false, methods: [] }
  }
}

export function isValidWalletTypeId(id) {
  return /^[a-z0-9_]{2,40}$/.test(String(id ?? ''))
}

export function isKnownWalletId(id) {
  return WALLET_METHOD_IDS.includes(String(id ?? ''))
}

/** Trim, strip control characters, cap length. Empty → null. */
export function sanitizeReference(value) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return cleaned || null
}

/** Rejection reasons are admin-authored; same hygiene, slightly longer cap. */
export function sanitizeReason(value) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
  return cleaned || null
}

/**
 * Identify image type from magic bytes — never trust the declared MIME.
 * Returns 'image/jpeg' | 'image/png' | 'image/webp' | null.
 */
export function sniffImageMime(buf) {
  if (!buf || buf.length < 3) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * Validate a payment-proof screenshot submitted as a data URL.
 * Enforces: allowlisted format, strict base64 charset, size cap, magic bytes,
 * and declared-MIME == sniffed-MIME.
 * Returns { ok:true, mime, base64 } or { ok:false, error }.
 */
export function parseScreenshot(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) {
    return { ok: false, error: 'Screenshot image is required' }
  }
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match) {
    return { ok: false, error: 'Screenshot must be a JPEG, PNG or WebP image' }
  }
  const declared = match[1] === 'jpg' ? 'image/jpeg' : `image/${match[1]}`
  const b64 = match[2]
  // Cheap length pre-check before decoding (base64 expands bytes by 4/3).
  if (b64.length > Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4 + 8) {
    return { ok: false, error: 'Screenshot is too large (max 3MB)' }
  }
  const buf = Buffer.from(b64, 'base64')
  if (!buf.length) return { ok: false, error: 'Screenshot is empty' }
  if (buf.length > MAX_SCREENSHOT_BYTES) {
    return { ok: false, error: 'Screenshot is too large (max 3MB)' }
  }
  const sniffed = sniffImageMime(buf)
  if (!sniffed) {
    return { ok: false, error: 'Screenshot content is not a valid image' }
  }
  if (sniffed !== declared) {
    return { ok: false, error: 'Screenshot content does not match its declared type' }
  }
  return { ok: true, mime: sniffed, base64: b64 }
}

/**
 * Server-side price lookup — the client never sends an amount.
 * Returns a positive number or null when the plan row has no usable price.
 */
export function computeWalletAmount(planRow, billingPeriod) {
  if (!planRow) return null
  const price = billingPeriod === 'yearly' ? planRow.price_yearly : planRow.price_monthly
  const amount = Number(price)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100) / 100
}

/** True when a supabase error means the wallet_payment_requests table is missing. */
export function isMissingTableError(error) {
  if (!error) return false
  return error.code === '42P01' || /Could not find the table/i.test(error.message || '')
}
