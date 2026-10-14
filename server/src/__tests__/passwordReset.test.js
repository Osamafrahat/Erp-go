import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Controllable supabase stub: every from(table) returns a chain whose
// terminals resolve from `tables`; every write is recorded in `calls`.
let tables = {}
let calls = []
const fromSpy = jest.fn((table) => {
  const chain = {}
  for (const m of ['select', 'eq', 'ilike', 'is', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain)
  }
  chain.insert = jest.fn((row) => { calls.push({ op: 'insert', table, row }); return chain })
  chain.update = jest.fn((payload) => { calls.push({ op: 'update', table, payload }); return chain })
  chain.delete = jest.fn(() => { calls.push({ op: 'delete', table }); return chain })
  chain.maybeSingle = jest.fn(() => Promise.resolve(tables[table] ?? { data: null, error: null }))
  return chain
})

const sendPasswordResetEmail = jest.fn(() => Promise.resolve({ data: { id: 'mail-1' } }))

jest.unstable_mockModule('../db/supabase.js', () => ({
  // Mirrors the real module's surface exactly: supabase is DEFAULT-only.
  // A superset mock here once let a bad named import pass CI and crash prod.
  default: { from: fromSpy },
  supabaseStorage: { from: fromSpy },
  withTimeout: (p) => p,
}))
jest.unstable_mockModule('../services/emailService.js', () => ({
  sendPasswordResetEmail,
  sendWelcomeEmail: jest.fn(),
  sendSubscriptionActivatedEmail: jest.fn(),
  sendEmail: jest.fn(),
  sendPromotionEmail: jest.fn(),
  sendCustomEmail: jest.fn(),
}))

const { issueResetToken, consumeResetToken, hashToken, clientBaseUrl } = await import('../services/passwordReset.js')

const NOW = Date.now()
const FUTURE = new Date(NOW + 60_000).toISOString()
const PAST = new Date(NOW - 60_000).toISOString()

beforeEach(() => {
  jest.clearAllMocks()
  tables = {}
  calls = []
})

describe('hashToken', () => {
  it('is deterministic sha256 and never equals the raw token', () => {
    const raw = 'raw-token-value'
    expect(hashToken(raw)).toBe(hashToken(raw))
    expect(hashToken(raw)).not.toBe(raw)
    expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('issueResetToken', () => {
  it('does nothing and reports sent:false for an unknown email', async () => {
    tables.users = { data: null, error: null }
    const r = await issueResetToken('nobody@example.com')
    expect(r.sent).toBe(false)
    expect(calls).toEqual([])
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('does nothing for an inactive account', async () => {
    tables.users = { data: { id: 7, email: 'a@b.c', is_active: false }, error: null }
    const r = await issueResetToken('a@b.c')
    expect(r.sent).toBe(false)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('stores only the hash, deletes stale tokens, and emails the raw token', async () => {
    tables.users = { data: { id: 7, email: 'a@b.c', full_name: 'A', username: 'a', is_active: true }, error: null }
    const r = await issueResetToken('a@b.c')

    expect(r.sent).toBe(true)
    // stale tokens for the user dropped
    expect(calls.find(c => c.op === 'delete' && c.table === 'password_reset_tokens')).toBeTruthy()
    // the insert carries the HASH, never the raw token
    const insert = calls.find(c => c.op === 'insert' && c.table === 'password_reset_tokens')
    expect(insert.row.user_id).toBe(7)
    expect(insert.row.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(new Date(insert.row.expires_at).getTime()).toBeGreaterThan(NOW)
    // the email got the RAW token via the reset URL
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1)
    const { to, resetUrl } = sendPasswordResetEmail.mock.calls[0][0]
    expect(to).toBe('a@b.c')
    expect(resetUrl).toContain('/reset-password?token=')
    const raw = resetUrl.split('token=')[1]
    expect(hashToken(raw)).toBe(insert.row.token_hash)
  })

  it('still reports sent:true when email delivery fails (response must not leak state)', async () => {
    tables.users = { data: { id: 7, email: 'a@b.c', is_active: true }, error: null }
    sendPasswordResetEmail.mockRejectedValueOnce(new Error('resend down'))
    const r = await issueResetToken('a@b.c')
    expect(r.sent).toBe(true)
  })

  it('escapes ilike wildcards in the email input', async () => {
    tables.users = { data: null, error: null }
    await issueResetToken('a%_b@c.com')
    const ilikeCall = fromSpy.mock.results.find(() => true) // chain built for 'users'
    expect(fromSpy).toHaveBeenCalledWith('users')
    // the pattern must not contain raw % or _ wildcards
    const usersChain = fromSpy.mock.results[0].value
    const pattern = usersChain.ilike.mock.calls[0][1]
    // % and _ must arrive backslash-escaped so they match literally
    expect(pattern).toBe('a\\%\\_b@c.com')
  })
})

describe('consumeResetToken', () => {
  const TOKEN = 'the-raw-token'
  const TOKEN_HASH = hashToken(TOKEN)

  function expectPasswordUpdated() {
    const upd = calls.find(c => c.op === 'update' && c.table === 'users')
    expect(upd).toBeTruthy()
    expect(upd.payload.session_token).toBeNull()
    expect(upd.payload.must_change_password).toBe(false)
    return upd
  }

  it('rejects an unknown token', async () => {
    tables.password_reset_tokens = { data: null, error: null }
    const r = await consumeResetToken(TOKEN, 'NewPass123')
    expect(r.ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('rejects an expired token', async () => {
    tables.password_reset_tokens = { data: { id: 1, user_id: 7, expires_at: PAST, used_at: null }, error: null }
    const r = await consumeResetToken(TOKEN, 'NewPass123')
    expect(r.ok).toBe(false)
    expect(calls.find(c => c.op === 'update' && c.table === 'users')).toBeFalsy()
  })

  it('rejects an already-used token (single use)', async () => {
    tables.password_reset_tokens = { data: { id: 1, user_id: 7, expires_at: FUTURE, used_at: PAST }, error: null }
    const r = await consumeResetToken(TOKEN, 'NewPass123')
    expect(r.ok).toBe(false)
  })

  it('on success: hashes the new password, kills sessions, marks the token used', async () => {
    tables.password_reset_tokens = { data: { id: 1, user_id: 7, expires_at: FUTURE, used_at: null }, error: null }
    const r = await consumeResetToken(TOKEN, 'NewPass123')

    expect(r.ok).toBe(true)
    expect(r.userId).toBe(7)
    const upd = expectPasswordUpdated()
    expect(upd.payload.password).not.toBe('NewPass123')
    expect(upd.payload.password).toMatch(/^\$2[aby]\$/) // bcrypt
    // token marked used
    const usedUpd = calls.find(c => c.op === 'update' && c.table === 'password_reset_tokens')
    expect(usedUpd.payload.used_at).toBeTruthy()
  })
})

describe('clientBaseUrl', () => {
  const KEYS = ['CLIENT_URL', 'FRONTEND_URL', 'ALLOWED_ORIGINS']
  let saved

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
    KEYS.forEach((k) => delete process.env[k])
  })

  afterEach(() => {
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    })
  })

  it('prefers CLIENT_URL over FRONTEND_URL over ALLOWED_ORIGINS', () => {
    process.env.CLIENT_URL = 'https://a.example.com'
    process.env.FRONTEND_URL = 'https://b.example.com'
    process.env.ALLOWED_ORIGINS = 'https://c.example.com'
    expect(clientBaseUrl()).toBe('https://a.example.com')
    delete process.env.CLIENT_URL
    expect(clientBaseUrl()).toBe('https://b.example.com')
    delete process.env.FRONTEND_URL
    expect(clientBaseUrl()).toBe('https://c.example.com')
  })

  it('uses FRONTEND_URL when CLIENT_URL is unset (the production shape)', () => {
    // This is the exact production config that once mailed a localhost link.
    process.env.FRONTEND_URL = 'https://erp-go.vercel.app'
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,https://erp-go.vercel.app,http://localhost:3001'
    expect(clientBaseUrl()).toBe('https://erp-go.vercel.app')
  })

  it('never picks a loopback origin from ALLOWED_ORIGINS when a public one exists', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,https://public.example.com,http://127.0.0.1:3001'
    expect(clientBaseUrl()).toBe('https://public.example.com')
  })

  it('falls back to loopback when that is all ALLOWED_ORIGINS has (dev machine)', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:3001'
    expect(clientBaseUrl()).toBe('http://localhost:5173')
  })

  it('falls back to localhost with no configuration at all', () => {
    expect(clientBaseUrl()).toBe('http://localhost:5173')
  })
})
