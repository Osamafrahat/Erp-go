// senderFor — split sender addresses per mail category.
//
// Every transactional/marketing sender resolves through senderFor so each
// category can use its own From on the verified dukkanza.com domain instead
// of one global SMTP_FROM. These tests pin the three resolution rules:
// category env override > local part derived from the SMTP_FROM domain >
// Resend test-sender fallback.

import { senderFor } from '../services/emailService.js'

const TRACKED = ['SMTP_FROM', 'MAIL_FROM_SUPPORT', 'MAIL_FROM_BILLING', 'MAIL_FROM_NO_REPLY']
let saved

beforeAll(() => {
  saved = Object.fromEntries(TRACKED.map((k) => [k, process.env[k]]))
})

afterEach(() => {
  for (const k of TRACKED) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function clearAll() {
  for (const k of TRACKED) delete process.env[k]
}

describe('senderFor - split sender addresses', () => {
  test('derives each category address from the SMTP_FROM domain', () => {
    clearAll()
    process.env.SMTP_FROM = 'orders@dukkanza.com'
    expect(senderFor('support')).toBe('support@dukkanza.com')
    expect(senderFor('billing')).toBe('billing@dukkanza.com')
    expect(senderFor('hello')).toBe('hello@dukkanza.com')
    expect(senderFor('promotions')).toBe('promotions@dukkanza.com')
    expect(senderFor('no-reply')).toBe('no-reply@dukkanza.com')
  })

  test('MAIL_FROM_<CATEGORY> overrides the derived address', () => {
    clearAll()
    process.env.SMTP_FROM = 'orders@dukkanza.com'
    process.env.MAIL_FROM_SUPPORT = 'help@dukkanza.com'
    expect(senderFor('support')).toBe('help@dukkanza.com')
    expect(senderFor('billing')).toBe('billing@dukkanza.com')
  })

  test('dashes map to underscores in the env key (no-reply -> MAIL_FROM_NO_REPLY)', () => {
    clearAll()
    process.env.MAIL_FROM_NO_REPLY = 'system@dukkanza.com'
    expect(senderFor('no-reply')).toBe('system@dukkanza.com')
  })

  test('falls back to the Resend test sender when nothing is configured', () => {
    clearAll()
    expect(senderFor('support')).toBe('onboarding@resend.dev')
  })
})
