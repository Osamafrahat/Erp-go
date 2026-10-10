import { describe, it, expect } from '@jest/globals'
import {
  MAX_SCREENSHOT_BYTES,
  computeWalletAmount,
  getWalletMethods,
  isKnownWalletId,
  isMissingTableError,
  isValidWalletTypeId,
  parseScreenshot,
  sanitizeReason,
  sanitizeReference,
  sniffImageMime,
} from '../services/walletPaymentUtils.js'

// --- fixtures -------------------------------------------------------------

const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('fake-jpeg-payload'),
])
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake-png-payload'),
])
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
])

const asDataUrl = (bytes, type) => `data:${type};base64,${bytes.toString('base64')}`

// --- getWalletMethods -----------------------------------------------------

describe('getWalletMethods', () => {
  it('is unconfigured until the operator supplies WALLET_CONFIG', () => {
    expect(getWalletMethods({})).toEqual({ configured: false, methods: [] })
  })

  it('stays unconfigured on malformed JSON or non-array input', () => {
    expect(getWalletMethods({ WALLET_CONFIG: '{not json' }).configured).toBe(false)
    expect(getWalletMethods({ WALLET_CONFIG: '{"id":"x"}' }).configured).toBe(false)
    expect(getWalletMethods({ WALLET_CONFIG: '[]' }).configured).toBe(false)
  })

  it('parses valid config and sanitizes every field', () => {
    const env = {
      WALLET_CONFIG: JSON.stringify([
        { id: ' Vodafone_Cash ', name: 'Vodafone Cash\u0000', name_ar: 'فودافون كاش', number: '01012345678' },
        { id: 'instapay', name: 'InstaPay', name_ar: 'انستاباي', number: 'biz@instapay' },
      ]),
    }
    const cfg = getWalletMethods(env)
    expect(cfg.configured).toBe(true)
    expect(cfg.methods).toHaveLength(2)
    // id lowercased + trimmed, control chars stripped, lengths sane
    expect(cfg.methods[0].id).toBe('vodafone_cash')
    expect(cfg.methods[0].name).toBe('Vodafone Cash')
    expect(cfg.methods[1].number).toBe('biz@instapay')
  })

  it('drops entries without a valid id, name or number', () => {
    const env = {
      WALLET_CONFIG: JSON.stringify([
        { id: 'ok_method', name: 'Ok', number: '123' },
        { id: 'bad id!', name: 'Nope', number: '123' },
        { id: 'no_number', name: 'Nope' },
        { id: 'no_name', number: '123' },
        null,
        'string-entry',
      ]),
    }
    const cfg = getWalletMethods(env)
    expect(cfg.configured).toBe(true)
    expect(cfg.methods.map((m) => m.id)).toEqual(['ok_method'])
  })
})

// --- wallet type ids ------------------------------------------------------

describe('isValidWalletTypeId / isKnownWalletId', () => {
  it('accepts slug-like ids only', () => {
    expect(isValidWalletTypeId('vodafone_cash')).toBe(true)
    expect(isValidWalletTypeId('instapay')).toBe(true)
    expect(isValidWalletTypeId("'; DROP TABLE users;--")).toBe(false)
    expect(isValidWalletTypeId('../etc/passwd')).toBe(false)
    expect(isValidWalletTypeId('')).toBe(false)
    expect(isValidWalletTypeId(null)).toBe(false)
    expect(isValidWalletTypeId('a'.repeat(41))).toBe(false)
  })

  it('knows the canonical Egyptian wallet ids', () => {
    expect(isKnownWalletId('instapay')).toBe(true)
    expect(isKnownWalletId('wallet_of_evil')).toBe(false)
  })
})

// --- reference / reason hygiene -------------------------------------------

describe('sanitizeReference', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(sanitizeReference('  TRX\u00001234\n  extra  ')).toBe('TRX 1234 extra')
  })

  it('caps at 120 characters', () => {
    expect(sanitizeReference('x'.repeat(500))).toHaveLength(120)
  })

  it('returns null for empty or non-string input', () => {
    expect(sanitizeReference('   ')).toBeNull()
    expect(sanitizeReference(undefined)).toBeNull()
    expect(sanitizeReference({ note: 'x' })).toBeNull()
  })
})

describe('sanitizeReason', () => {
  it('requires real content and caps at 300 characters', () => {
    expect(sanitizeReason('Amount did not match')).toBe('Amount did not match')
    expect(sanitizeReason('\u0007\u0008')).toBeNull()
    expect(sanitizeReason('y'.repeat(1000))).toHaveLength(300)
  })
})

// --- magic-byte sniffing --------------------------------------------------

describe('sniffImageMime', () => {
  it('identifies jpeg, png and webp by magic bytes', () => {
    expect(sniffImageMime(JPEG_BYTES)).toBe('image/jpeg')
    expect(sniffImageMime(PNG_BYTES)).toBe('image/png')
    expect(sniffImageMime(WEBP_BYTES)).toBe('image/webp')
  })

  it('rejects scripts, html, svg and empty buffers', () => {
    expect(sniffImageMime(Buffer.from('<script>alert(1)</script>'))).toBeNull()
    expect(sniffImageMime(Buffer.from('<?xml version="1.0"?><svg onload="alert(1)"/>'))).toBeNull()
    expect(sniffImageMime(Buffer.from('GIF89a'))).toBeNull()
    expect(sniffImageMime(Buffer.alloc(2))).toBeNull()
    expect(sniffImageMime(null)).toBeNull()
  })
})

// --- screenshot data-URL validation ---------------------------------------

describe('parseScreenshot', () => {
  it('accepts a genuine jpeg/png/webp data URL', () => {
    expect(parseScreenshot(asDataUrl(JPEG_BYTES, 'image/jpeg'))).toMatchObject({ ok: true, mime: 'image/jpeg' })
    expect(parseScreenshot(asDataUrl(PNG_BYTES, 'image/png'))).toMatchObject({ ok: true, mime: 'image/png' })
    expect(parseScreenshot(asDataUrl(WEBP_BYTES, 'image/webp'))).toMatchObject({ ok: true, mime: 'image/webp' })
  })

  it('rejects a mismatch between declared type and actual bytes', () => {
    const r = parseScreenshot(asDataUrl(JPEG_BYTES, 'image/png'))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/does not match/)
  })

  it('rejects non-image and script payloads even with a valid-looking prefix', () => {
    expect(parseScreenshot(`data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`).ok).toBe(false)
    expect(parseScreenshot('data:image/svg+xml;base64,PHN2Zz4=').ok).toBe(false)
    expect(parseScreenshot('data:text/html;base64,PHNjcmlwdD4=').ok).toBe(false)
  })

  it('rejects malformed base64 charset', () => {
    expect(parseScreenshot('data:image/png;base64,abc$%^&*()').ok).toBe(false)
    expect(parseScreenshot('data:image/png;base64,').ok).toBe(false)
  })

  it('rejects missing and non-string input', () => {
    expect(parseScreenshot(undefined).ok).toBe(false)
    expect(parseScreenshot(12345).ok).toBe(false)
    expect(parseScreenshot('').ok).toBe(false)
  })

  it('enforces the 3MB cap', () => {
    const oversize = Buffer.concat([JPEG_BYTES, Buffer.alloc(MAX_SCREENSHOT_BYTES + 1, 0x41)])
    const r = parseScreenshot(asDataUrl(oversize, 'image/jpeg'))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/too large/)
  })

  it('allows a proof just under the cap', () => {
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(MAX_SCREENSHOT_BYTES - JPEG_BYTES.length - 1, 0x41)])
    expect(parseScreenshot(asDataUrl(big, 'image/jpeg')).ok).toBe(true)
  })
})

// --- server-side amount computation ---------------------------------------

describe('computeWalletAmount', () => {
  const pro = { slug: 'pro', price_monthly: 600, price_yearly: 5990 }

  it('reads the price for the requested period from the DB row', () => {
    expect(computeWalletAmount(pro, 'monthly')).toBe(600)
    expect(computeWalletAmount(pro, 'yearly')).toBe(5990)
  })

  it('never produces a non-positive amount', () => {
    expect(computeWalletAmount({ price_monthly: 0, price_yearly: 0 }, 'monthly')).toBeNull()
    expect(computeWalletAmount({ price_monthly: 'abc' }, 'monthly')).toBeNull()
    expect(computeWalletAmount(null, 'monthly')).toBeNull()
    expect(computeWalletAmount({}, 'yearly')).toBeNull()
  })

  it('coerces numeric strings and rounds to piastres', () => {
    expect(computeWalletAmount({ price_monthly: '599.999' }, 'monthly')).toBe(600)
  })
})

// --- missing-table detection (pre-migration graceful degradation) ---------

describe('isMissingTableError', () => {
  it('recognises supabase missing-table errors', () => {
    expect(isMissingTableError({ code: '42P01', message: 'relation does not exist' })).toBe(true)
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.wallet_payment_requests' in the schema cache" })).toBe(true)
    expect(isMissingTableError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
  })
})
