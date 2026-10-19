// senderFor — split sender addresses per mail category.
//
// Every transactional/marketing sender resolves through senderFor so each
// category can use its own From on the verified dukkanza.com domain instead
// of one global SMTP_FROM. sendPayload is the single choke point that
// injects the optional MAIL_REPLY_TO mailbox. These tests pin the
// resolution rules and the reply mailbox injection — including the camelCase
// replyTo key the Resend SDK v6 requires (snake_case reply_to is dropped).

import { jest } from '@jest/globals'
import { senderFor, sendPayload } from '../services/emailService.js'

const TRACKED = ['SMTP_FROM', 'MAIL_FROM_SUPPORT', 'MAIL_FROM_BILLING', 'MAIL_FROM_NO_REPLY', 'MAIL_REPLY_TO']
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

describe('sendPayload - reply mailbox injection', () => {
  const payload = { from: 'support@dukkanza.com', to: 'a@b.c', subject: 's', html: '<p>' }

  test('adds camelCase replyTo when MAIL_REPLY_TO is set (SDK v6 wire key)', () => {
    clearAll()
    process.env.MAIL_REPLY_TO = 'inbox@example.com'
    const send = jest.fn().mockResolvedValue({ data: { id: 'x' }, error: null })
    sendPayload({ emails: { send } }, payload)
    expect(send).toHaveBeenCalledWith({ ...payload, replyTo: 'inbox@example.com' })
    // snake_case would be silently dropped by the SDK — never send it
    expect(send.mock.calls[0][0].reply_to).toBeUndefined()
  })

  test('leaves the payload untouched when MAIL_REPLY_TO is unset', () => {
    clearAll()
    const send = jest.fn().mockResolvedValue({ data: { id: 'x' }, error: null })
    sendPayload({ emails: { send } }, payload)
    expect(send).toHaveBeenCalledWith(payload)
  })
})
