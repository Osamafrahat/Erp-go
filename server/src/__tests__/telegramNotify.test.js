// telegram notify: best-effort push when a wallet transfer is submitted.
//
// The contract (mirrors lifecycleEmails): never reject, never block the
// caller, and do nothing at all unless both secrets are configured. These
// tests pin the disabled-by-default behavior - the feature must stay inert
// until TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are set on Fly.

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

jest.unstable_mockModule('../db/supabase.js', () => ({
  default: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: { name: 'Test Store' }, error: null }),
        })),
      })),
    })),
  },
  supabaseStorage: { from: jest.fn() },
  withTimeout: (p) => p,
}))

const { notifyWalletTransfer } = await import('../services/telegramNotify.js')

const submission = {
  tenantId: 42,
  planSlug: 'pro',
  billingPeriod: 'monthly',
  amountEgp: 199,
  walletType: 'instapay',
  referenceNote: 'TRX-123',
  paymentCode: 'wallet-123-abc',
}

const realFetch = globalThis.fetch

describe('notifyWalletTransfer', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
    jest.restoreAllMocks()
  })

  it('is a no-op without secrets and does not call Telegram', async () => {
    await expect(notifyWalletTransfer(submission)).resolves.toBeUndefined()
    expect(globalThis.fetch).not.toHaveBeenCalled()

    // token without chat id is still "not configured"
    process.env.TELEGRAM_BOT_TOKEN = '123:abc'
    await notifyWalletTransfer(submission)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sends an HTML message with chat id, store, and payment code', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'

    await notifyWalletTransfer(submission)

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bot123:secret-token/sendMessage')

    const body = JSON.parse(init.body)
    expect(body.chat_id).toBe('987654')
    expect(body.parse_mode).toBe('HTML')
    expect(body.text).toContain('Test Store') // tenant name lookup result
    expect(body.text).toContain('pro') // plan slug
    expect(body.text).toContain('199 EGP')
    expect(body.text).toContain('wallet-123-abc') // payment code
    expect(body.text).toContain('TRX-123') // reference note
  })

  it('escapes tenant-controlled text before it reaches Telegram HTML', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'

    await notifyWalletTransfer({ ...submission, referenceNote: '<b>x</b> & y' })

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.text).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(body.text).not.toContain('<b>x</b>')
  })

  it('never rejects when Telegram fails (network error or non-2xx)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'

    // network failure
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(notifyWalletTransfer(submission)).resolves.toBeUndefined()

    // HTTP error response - logged, still resolves
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 })
    await expect(notifyWalletTransfer(submission)).resolves.toBeUndefined()
  })
})
