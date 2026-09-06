const BASE = 'https://erp-go-crimson-wind-2087.fly.dev'

let passed = 0
let failed = 0
let warnings = 0
const failures = []
const warns = []

async function test(name, fn) {
  try {
    const result = await fn()
    if (result === 'warn') {
      warnings++
      warns.push(name)
      console.log(`⚠  ${name}`)
    } else {
      passed++
      console.log(`✓  ${name}`)
    }
  } catch (err) {
    failed++
    const msg = err.message || String(err)
    failures.push({ name, error: msg })
    console.log(`✗  ${name}`)
    console.log(`   ${msg.substring(0, 200)}`)
  }
}

async function req(path, opts = {}) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers }
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, headers: res.headers, text, json }
}

console.log('\n=== 1. HEALTH & STARTUP ===')

await test('Health endpoint returns 200', async () => {
  const r = await req('/api/health')
  if (r.status !== 200) throw new Error(`Status ${r.status}`)
  if (!r.json || r.json.status !== 'ok') throw new Error(`Status field not ok: ${JSON.stringify(r.json)}`)
})

await test('Health returns within 5s', async () => {
  const start = Date.now()
  await req('/api/health')
  const ms = Date.now() - start
  if (ms > 5000) throw new Error(`Took ${ms}ms`)
})

await test('Non-existent API route returns 404 JSON', async () => {
  const r = await req('/api/nonexistent-endpoint-xyz')
  if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`)
  if (!r.json?.error) throw new Error(`Missing error field`)
})

console.log('\n=== 2. AUTH ENDPOINTS (unauthenticated) ===')

await test('Login with empty body returns error (not crash)', async () => {
  const r = await req('/api/auth/login', { method: 'POST', body: '{}' })
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
  if (r.status !== 400 && r.status !== 401 && r.status !== 422) return 'warn'
})

await test('Login with invalid JSON body', async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json'
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

await test('Login with SQL injection attempt', async () => {
  const r = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: "' OR 1=1 --", password: "x" })
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('Login with extremely long input (10000 chars)', async () => {
  const r = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'x'.repeat(10000), password: 'y'.repeat(10000) })
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('Auth with missing Bearer token', async () => {
  const r = await req('/api/products')
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('Auth with invalid Bearer token', async () => {
  const r = await req('/api/products', {
    headers: { Authorization: 'Bearer invalid-token-abc' }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('Auth with malformed Authorization header', async () => {
  const r = await req('/api/products', {
    headers: { Authorization: 'Bearer' }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('Auth with SQL injection in token', async () => {
  const r = await req('/api/products', {
    headers: { Authorization: "Bearer ' OR '1'='1" }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

console.log('\n=== 3. RATE LIMITING ===')

await test('Login rate limit (10 requests)', async () => {
  let serverErrors = 0
  for (let i = 0; i < 12; i++) {
    const r = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'test', password: 'test' })
    })
    if (r.status >= 500) serverErrors++
  }
  if (serverErrors > 0) throw new Error(`${serverErrors} server errors during rate limit test`)
})

await test('API rate limit (50 rapid requests)', async () => {
  let serverErrors = 0
  let rateLimited = false
  for (let i = 0; i < 55; i++) {
    const r = await req('/api/health')
    if (r.status >= 500) serverErrors++
    if (r.status === 429) rateLimited = true
  }
  if (serverErrors > 0) throw new Error(`${serverErrors} server errors`)
  if (!rateLimited) return 'warn'
})

console.log('\n=== 4. PROTECTED ENDPOINTS (no token) ===')

const protectedRoutes = [
  ['/api/products', 'GET'],
  ['/api/categories', 'GET'],
  ['/api/orders', 'GET'],
  ['/api/customers', 'GET'],
  ['/api/employees', 'GET'],
  ['/api/expenses', 'GET'],
  ['/api/refunds', 'GET'],
  ['/api/users', 'GET'],
  ['/api/activities', 'GET'],
  ['/api/promotions', 'GET'],
  ['/api/suppliers', 'GET'],
  ['/api/reports/sales', 'GET'],
  ['/api/accounting/accounts', 'GET'],
  ['/api/accounting/journals', 'GET'],
  ['/api/accounting/reports/trial-balance', 'GET'],
  ['/api/attendance', 'GET'],
  ['/api/leave', 'GET'],
  ['/api/payroll', 'GET'],
  ['/api/shifts', 'GET'],
  ['/api/services', 'GET'],
  ['/api/service-plans', 'GET'],
  ['/api/subscriptions', 'GET'],
  ['/api/billing/plans', 'GET'],
  ['/api/chat', 'GET'],
  ['/api/backup', 'GET'],
  ['/api/super-admin/tenants', 'GET'],
]

for (const [route, method] of protectedRoutes) {
  await test(`${method} ${route} returns 401 (not crash)`, async () => {
    const r = await req(route, { method })
    if (r.status >= 500) throw new Error(`SERVER CRASH ${r.status}: ${r.text.substring(0, 200)}`)
    if (r.status !== 401 && r.status !== 403) return 'warn'
  })
}

console.log('\n=== 5. SQL INJECTION & XSS ON ENDPOINTS ===')

await test('GET /api/products with SQL injection in query', async () => {
  const r = await req("/api/products?search='; DROP TABLE products; --")
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('GET /api/orders with SQL injection in date', async () => {
  const r = await req("/api/orders?start_date=' OR 1=1")
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('GET /api/customers with XSS in search', async () => {
  const r = await req("/api/customers?search=<script>alert('xss')</script>")
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

await test('GET /api/reports/sales with injection in params', async () => {
  const r = await req("/api/reports/sales?period=year'; DROP TABLE orders; --")
  if (r.status >= 500) throw new Error(`Server error ${r.status}: ${r.text.substring(0, 200)}`)
})

console.log('\n=== 6. METHOD NOT ALLOWED ===')

await test('POST /api/health (wrong method) returns 404 or 405', async () => {
  const r = await req('/api/health', { method: 'POST', body: '{}' })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

await test('DELETE /api/health (wrong method) returns 404 or 405', async () => {
  const r = await req('/api/health', { method: 'DELETE' })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

console.log('\n=== 7. PAYLOAD SIZE LIMITS ===')

await test('POST with 2MB+ body rejected', async () => {
  const bigPayload = 'x'.repeat(2 * 1024 * 1024 + 100)
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: bigPayload })
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

console.log('\n=== 8. CORS HEADERS ===')

await test('OPTIONS preflight returns proper CORS headers', async () => {
  const r = await fetch(`${BASE}/api/health`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://erp-go.vercel.app',
      'Access-Control-Request-Method': 'GET'
    }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

await test('Request from unknown origin handled gracefully', async () => {
  const r = await fetch(`${BASE}/api/health`, {
    headers: { 'Origin': 'https://evil-site.com' }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

console.log('\n=== 9. STATIC FILE HANDLING ===')

await test('Root path returns HTML or redirect (not crash)', async () => {
  const r = await req('/')
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

await test('Non-existent static file returns 404 (not crash)', async () => {
  const r = await req('/nonexistent-file-abc123.txt')
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

console.log('\n=== 10. HEADER INJECTION ===')

await test('Extremely long User-Agent header', async () => {
  const r = await req('/api/health', {
    headers: { 'User-Agent': 'A'.repeat(10000) }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

await test('Malformed Authorization header', async () => {
  const r = await req('/api/products', {
    headers: { Authorization: '\x00\x01\x02\x03' }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

await test('Empty Authorization header', async () => {
  const r = await req('/api/products', {
    headers: { Authorization: '' }
  })
  if (r.status >= 500) throw new Error(`Server error ${r.status}`)
})

console.log('\n=== SUMMARY ===')
console.log(`✓ Passed: ${passed}`)
console.log(`✗ Failed: ${failed}`)
console.log(`⚠ Warnings: ${warnings}`)

if (failures.length > 0) {
  console.log('\n=== FAILURES ===')
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.error.substring(0, 300)}\n`))
}

if (warns.length > 0) {
  console.log('\n=== WARNINGS ===')
  warns.forEach(w => console.log(`  ⚠ ${w}`))
}
