import { describe, it, expect } from '@jest/globals'

const BASE = process.env.TEST_API_URL || 'http://localhost:3001'

describe('Security Headers', () => {
  it('returns security headers from helmet', async () => {
    const res = await fetch(`${BASE}/api/health`)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-xss-protection')).toBeDefined()
  })

  it('does not expose x-powered-by', async () => {
    const res = await fetch(`${BASE}/api/health`)
    expect(res.headers.get('x-powered-by')).toBeNull()
  })
})

describe('Input Validation', () => {
  it('rejects malformed JSON body', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})

describe('CORS', () => {
  it('allows requests without origin (server-to-server)', async () => {
    const res = await fetch(`${BASE}/api/health`)
    expect(res.status).toBe(200)
  })

  it('rejects preflight with disallowed origin', async () => {
    const res = await fetch(`${BASE}/api/products`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil-site.com',
        'Access-Control-Request-Method': 'GET',
      },
    })
    const allowOrigin = res.headers.get('access-control-allow-origin')
    expect(allowOrigin).not.toBe('https://evil-site.com')
  })
})

describe('SQL Injection', () => {
  it('login with SQL injection in username does not crash', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: "' OR 1=1 --", password: "' OR 1=1 --" }),
    })
    expect(res.status).not.toBe(500)
  })
})

describe('XSS', () => {
  it('login with script tag in username does not reflect it', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '<script>alert("xss")</script>', password: 'test' }),
    })
    const text = await res.text()
    expect(text).not.toContain('<script>')
  })
})

describe('Content Security Policy', () => {
  it('returns CSP headers', async () => {
    const res = await fetch(`${BASE}/api/health`)
    const csp = res.headers.get('content-security-policy')
    expect(csp).toBeDefined()
    expect(csp).toContain("defaultSrc")
  })
})

describe('Request Size Limits', () => {
  it('rejects oversized request bodies', async () => {
    const largeBody = JSON.stringify({ data: 'x'.repeat(6 * 1024 * 1024) })
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody,
    })
    expect([400, 413]).toContain(res.status)
  })
})
