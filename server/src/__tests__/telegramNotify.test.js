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

const { notifyWalletTransfer, notifyOperator, notifyOperatorOnce, __resetTelegramForTests } = await import('../services/telegramNotify.js')

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
    __resetTelegramForTests()
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

describe('notifyOperator', () => {
  let enabled

  beforeEach(() => {
    __resetTelegramForTests()
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
    enabled = () => {
      process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
      process.env.TELEGRAM_CHAT_ID = '987654'
    }
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
    jest.restoreAllMocks()
  })

  it('is a no-op without secrets', async () => {
    await expect(notifyOperator({ title: 'hi' })).resolves.toBeUndefined()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('escapes EVERY caller-supplied string centrally (title, lines, emoji)', async () => {
    enabled()
    await notifyOperator({
      emoji: '<i>x</i>',
      title: '<b>evil</b> & raw',
      lines: ['<script>alert(1)</script>', '<a href="http://evil">click</a>'],
      link: false,
    })

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    // caller HTML is inert
    expect(body.text).toContain('&lt;b&gt;evil&lt;/b&gt; &amp; raw')
    expect(body.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(body.text).toContain('&lt;a href="http://evil"&gt;') // tag neutralized, quotes are inert in text nodes
    expect(body.text).not.toContain('<script>')
    expect(body.text).not.toContain('<a href="http://evil">')
    expect(body.text).toContain('&lt;i&gt;x&lt;/i&gt;') // emoji slot escaped too
    // no panel link when link:false
    expect(body.text).not.toContain('Open super admin panel')
  })

  it('appends the fixed panel link only when link is not false', async () => {
    enabled()
    await notifyOperator({ title: 'with link' })
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.text).toContain('<a href="https://dukkanza.com/super-admin">')
  })

  it('clips over-long lines and keeps the total under Telegram limits', async () => {
    enabled()
    await notifyOperator({
      title: 'clip',
      lines: ['x'.repeat(1000)],
      link: false,
    })
    let body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.text.length).toBeLessThanOrEqual(300)
    expect(body.text).toContain('...')

    // a huge list collapses to a "+N more" tail instead of a 4096 breach
    __resetTelegramForTests()
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 })
    const manyLines = Array.from({ length: 600 }, (_, i) => `row ${i} ${'-'.repeat(60)}`)
    await notifyOperator({ title: 'bulk', lines: manyLines, link: true })
    body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.text.length).toBeLessThanOrEqual(4096)
    expect(body.text).toContain('more')
  })

  it('never rejects', async () => {
    enabled()
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(notifyOperator({ title: 'x' })).resolves.toBeUndefined()
  })
})

describe('notifyOperatorOnce', () => {
  beforeEach(() => {
    __resetTelegramForTests()
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

  it('sends once per key within the cooldown, then again for a new key', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'

    await notifyOperatorOnce({ key: 'route-a-500', title: 'one', link: false })
    await notifyOperatorOnce({ key: 'route-a-500', title: 'one', link: false })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    await notifyOperatorOnce({ key: 'route-b-500', title: 'two', link: false })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('is a no-op without secrets and does not burn the dedupe registry', async () => {
    await notifyOperatorOnce({ key: 'k', title: 'x' })
    expect(globalThis.fetch).not.toHaveBeenCalled()

    // once configured, the same key must still be claimable (the disabled
    // call above must not have marked it as sent)
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'
    await notifyOperatorOnce({ key: 'k', title: 'x' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('drops malformed keys (empty / non-string / oversized)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'

    await notifyOperatorOnce({ key: '', title: 'x' })
    await notifyOperatorOnce({ key: 12345, title: 'x' })
    await notifyOperatorOnce({ key: 'x'.repeat(600), title: 'x' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('caps outbound sends at 20/minute regardless of dedupe keys', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:secret-token'
    process.env.TELEGRAM_CHAT_ID = '987654'

    const calls = []
    for (let i = 0; i < 30; i += 1) {
      calls.push(notifyOperatorOnce({ key: `flood-${i}`, title: `flood ${i}`, link: false }))
    }
    await Promise.all(calls)

    expect(globalThis.fetch.mock.calls.length).toBeLessThanOrEqual(20)
    expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(0)
  })
})
