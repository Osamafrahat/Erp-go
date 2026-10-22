// Operator push hooks: capture500 (direct res.status(500) responses),
// errorHandler (failures arriving via next(err)) and lifecycleEmails
// (subscription activation).
//
// The real Telegram helpers are mocked here - dedupe, escaping and rate
// caps are pinned in telegramNotify.test.js against the real module; what
// these tests pin is the WIRING: which hook fires, with what payload, and
// that query strings (which may carry tokens/PII) never reach the message.

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { readFileSync } from 'node:fs'

const captureException = jest.fn()
const notifyOperator = jest.fn().mockResolvedValue(undefined)
const notifyOperatorOnce = jest.fn().mockResolvedValue(undefined)
const sendSubscriptionActivatedEmail = jest.fn().mockResolvedValue({})

// lifecycleEmails supabase chain: table-aware, rows mutable per test.
let tenantRow = { name: 'Store X' }
let adminRow = { email: 'admin@store.com', full_name: 'Admin', username: 'admin' }

jest.unstable_mockModule('../services/sentry.js', () => ({
  captureException,
  initSentry: jest.fn(),
  flushSentry: jest.fn(),
}))

jest.unstable_mockModule('../services/telegramNotify.js', () => ({
  notifyOperator,
  notifyOperatorOnce,
  notifyWalletTransfer: jest.fn().mockResolvedValue(undefined),
  __resetTelegramForTests: jest.fn(),
}))

jest.unstable_mockModule('../db/supabase.js', () => ({
  default: {
    from: jest.fn((table) => {
      if (table === 'tenants') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: tenantRow, error: null }) }) }),
        }
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({ maybeSingle: async () => ({ data: adminRow, error: null }) }),
                }),
              }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
    }),
  },
  supabaseStorage: { from: jest.fn() },
  withTimeout: (p) => p,
}))

jest.unstable_mockModule('../services/emailService.js', () => ({
  sendSubscriptionActivatedEmail,
  sendWelcomeEmail: jest.fn().mockResolvedValue({}),
}))

const { capture500Responses } = await import('../middleware/capture500.js')
const { errorHandler } = await import('../middleware/errorHandler.js')
const { notifySubscriptionActivated } = await import('../services/lifecycleEmails.js')

describe('capture500Responses -> telegram (direct 500s)', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    notifyOperator.mockResolvedValue(undefined)
    notifyOperatorOnce.mockResolvedValue(undefined)
    sendSubscriptionActivatedEmail.mockResolvedValue({})
    tenantRow = { name: 'Store X' }
    adminRow = { email: 'admin@store.com', full_name: 'Admin', username: 'admin' }
    // query string on purpose: a token-ish value that must never leak
    req = { method: 'POST', originalUrl: '/api/wallet/submit?token=SECRET123' }
    res = {
      statusCode: 200,
      locals: {},
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }
    next = jest.fn()
  })

  const mount = () => capture500Responses(req, res, next)

  it('pushes once for a direct 500, with the query string stripped', () => {
    mount()
    res.statusCode = 500
    res.json({ error: 'boom' })

    expect(notifyOperatorOnce).toHaveBeenCalledTimes(1)
    const args = notifyOperatorOnce.mock.calls[0][0]
    expect(args.key).toBe('5xx POST /api/wallet/submit 500')
    expect(args.lines[0]).toBe('POST /api/wallet/submit')
    expect(args.link).toBe(false)
    // SECURITY: nothing from the query string reaches key, lines or title
    expect(JSON.stringify(args)).not.toContain('SECRET123')
    expect(JSON.stringify(args)).not.toContain('?')
  })

  it('does not push for 4xx responses', () => {
    mount()
    res.statusCode = 404
    res.json({ error: 'nope' })
    expect(notifyOperatorOnce).not.toHaveBeenCalled()
  })

  it('pushes at most once even when json and send both fire', () => {
    mount()
    res.statusCode = 503
    res.json({ error: 'down' })
    res.send({ error: 'down again' })
    expect(notifyOperatorOnce).toHaveBeenCalledTimes(1)
    expect(notifyOperatorOnce.mock.calls[0][0].key).toContain('/api/wallet/submit 503')
  })

  it('does not push when the error handler already reported the request', () => {
    mount()
    res.locals.sentryReported = true // errorHandler flagged it
    res.statusCode = 500
    res.json({ error: 'already reported' })
    expect(captureException).not.toHaveBeenCalled()
    expect(notifyOperatorOnce).not.toHaveBeenCalled()
  })
})

describe('errorHandler -> telegram (next(err) failures)', () => {
  let req, res

  beforeEach(() => {
    jest.clearAllMocks()
    notifyOperator.mockResolvedValue(undefined)
    notifyOperatorOnce.mockResolvedValue(undefined)
    sendSubscriptionActivatedEmail.mockResolvedValue({})
    tenantRow = { name: 'Store X' }
    adminRow = { email: 'admin@store.com', full_name: 'Admin', username: 'admin' }
    req = { method: 'PUT', originalUrl: '/api/items/9?secret=abc&q=1' }
    res = {
      locals: {},
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
  })

  it('pushes once for a 500, with the query string stripped', () => {
    const err = Object.assign(new Error('db exploded'), { statusCode: 500 })
    errorHandler(err, req, res, jest.fn())

    expect(notifyOperatorOnce).toHaveBeenCalledTimes(1)
    const args = notifyOperatorOnce.mock.calls[0][0]
    expect(args.key).toBe('5xx PUT /api/items/9 500')
    expect(args.lines[0]).toBe('PUT /api/items/9')
    expect(args.lines[1]).toBe('db exploded')
    expect(JSON.stringify(args)).not.toContain('secret=abc')
    expect(JSON.stringify(args)).not.toContain('?')
    expect(res.locals.sentryReported).toBe(true)
  })

  it('does not push for 4xx errors (normal operation)', () => {
    const err = Object.assign(new Error('not found'), { statusCode: 404 })
    errorHandler(err, req, res, jest.fn())
    expect(notifyOperatorOnce).not.toHaveBeenCalled()
  })
})

describe('lifecycleEmails -> telegram (activation choke point)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    notifyOperator.mockResolvedValue(undefined)
    notifyOperatorOnce.mockResolvedValue(undefined)
    sendSubscriptionActivatedEmail.mockResolvedValue({})
    tenantRow = { name: 'Store X' }
    adminRow = { email: 'admin@store.com', full_name: 'Admin', username: 'admin' }
  })

  it('pushes the activation message and emails the first admin', async () => {
    await notifySubscriptionActivated(5, 'pro', '2026-11-01T00:00:00.000Z')

    expect(notifyOperator).toHaveBeenCalledTimes(1)
    const msg = notifyOperator.mock.calls[0][0]
    expect(msg.title).toBe('Subscription activated')
    expect(msg.lines).toEqual(['Store: Store X', 'Plan: pro', 'Expires: 2026-11-01'])
    expect(sendSubscriptionActivatedEmail).toHaveBeenCalledTimes(1)
  })

  it('still pushes when no admin email exists (push precedes the guard)', async () => {
    adminRow = null
    await notifySubscriptionActivated(5, 'pro', '2026-11-01T00:00:00.000Z')

    expect(notifyOperator).toHaveBeenCalledTimes(1)
    expect(sendSubscriptionActivatedEmail).not.toHaveBeenCalled()
  })

  it('falls back to the tenant id when the tenant lookup returns nothing', async () => {
    tenantRow = null
    await notifySubscriptionActivated(77, 'enterprise', null)

    const msg = notifyOperator.mock.calls[0][0]
    expect(msg.lines[0]).toBe('Store: #77')
    expect(msg.lines[2]).toBe('Expires: ')
  })
})

describe('telegram hook wiring (source pins)', () => {
  // Cheap regression net for the fire-and-forget hooks that have no unit
  // test of their own: if someone removes the call, this fails.
  const pins = [
    ['../routes/auth.js', 'notifyOperator'], // self-serve signup
    ['../routes/superAdmin.js', 'notifyOperator'], // tenant created by super admin
    ['../services/subscriptionExpiry.js', 'notifyOperator'], // expiry batches
    ['../services/subscriptionExpiry.js', 'expiring-'], // <=3-day warning key
    ['../routes/paymob.js', 'notifyOperatorOnce'], // terminal decline
    ['../routes/paymob.js', 'verification.status < 500'], // transient 5xx stays silent
    ['../index.js', 'notifyOperator'], // boot notice
    ['../index.js', 'FLY_APP_NAME'], // ...gated to production
    ['../routes/emailInbound.js', 'notifyOperator'], // verified support email
    ['../routes/emailInbound.js', 'New support email'],
    ['../middleware/capture500.js', "split('?')"], // query stripped
    ['../middleware/errorHandler.js', "split('?')"], // query stripped
  ]

  it.each(pins)('%s contains %s', (file, needle) => {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    expect(src).toContain(needle)
  })
})
