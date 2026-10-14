import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.JWT_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_ANON_KEY = 'test-anon'

// Controllable stand-in for the PostgREST client. Each `from()` returns a
// chain whose terminal (single/maybeSingle) resolves with `queryResult`.
let queryResult = { data: null, error: null }
const fromSpy = jest.fn(() => {
  const chain = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'upsert']) {
    chain[m] = jest.fn(() => chain)
  }
  chain.single = jest.fn(() => Promise.resolve(queryResult))
  chain.maybeSingle = jest.fn(() => Promise.resolve(queryResult))
  return chain
})

jest.unstable_mockModule('../db/supabase.js', () => ({
  default: { from: fromSpy },
  supabaseStorage: { from: fromSpy },
  withTimeout: (p) => p,
}))

const {
  authenticateToken, requireRole, requireManager, requirePermission, requireSuperAdmin, generateToken,
} = await import('../middleware/auth.js')

function makeRes() {
  const res = { statusCode: 200, status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
  return res
}

/** Run one middleware and report where it landed: 'next', or the 4xx payload. */
async function run(mw, req) {
  const res = makeRes()
  const next = jest.fn()
  await mw(req, res, next)
  if (next.mock.calls.length) return { outcome: 'next' }
  return { outcome: 'blocked', status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] }
}

const ACTIVE_SESSION_USER = { id: 7, session_token: 'sess-1', is_active: true }

describe('requireManager', () => {
  it('blocks anonymous', async () => {
    const r = await run(requireManager, {})
    expect(r.outcome).toBe('blocked')
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('PERMISSION_MANAGER_REQUIRED')
  })
  it('blocks CASHIER', async () => {
    const r = await run(requireManager, { user: { role: 'CASHIER' } })
    expect(r.outcome).toBe('blocked')
    expect(r.status).toBe(403)
  })
  it('allows MANAGER', async () => {
    expect((await run(requireManager, { user: { role: 'MANAGER' } })).outcome).toBe('next')
  })
  // Documents current semantics: MANAGER-only routes exclude SUPER_ADMIN.
  // If the open question ("allow SUPER_ADMIN on requireManager routes?")
  // is ever resolved the other way, update this test deliberately.
  it('blocks SUPER_ADMIN (MANAGER-only routes)', async () => {
    const r = await run(requireManager, { user: { role: 'SUPER_ADMIN' } })
    expect(r.outcome).toBe('blocked')
  })
})

describe('requireSuperAdmin', () => {
  it('blocks every tenant role', async () => {
    for (const role of ['MANAGER', 'SALES_MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR_MANAGER', 'INVENTORY_CLERK']) {
      const r = await run(requireSuperAdmin, { user: { role } })
      expect(r.outcome).toBe('blocked')
      expect(r.body.code).toBe('PERMISSION_SUPER_ADMIN_REQUIRED')
    }
  })
  it('allows SUPER_ADMIN', async () => {
    expect((await run(requireSuperAdmin, { user: { role: 'SUPER_ADMIN' } })).outcome).toBe('next')
  })
})

describe('requireRole', () => {
  it('blocks non-listed roles and reports the requirement', async () => {
    const mw = requireRole('MANAGER', 'SUPER_ADMIN')
    const r = await run(mw, { user: { role: 'CASHIER' } })
    expect(r.status).toBe(403)
    expect(r.body.required).toEqual(['MANAGER', 'SUPER_ADMIN'])
  })
  it('allows listed roles', async () => {
    expect((await run(requireRole('MANAGER', 'SUPER_ADMIN'), { user: { role: 'SUPER_ADMIN' } })).outcome).toBe('next')
  })
})

describe('requirePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryResult = { data: null, error: null }
  })

  it('401s anonymous', async () => {
    const r = await run(requirePermission('pos_access'), {})
    expect(r.status).toBe(401)
  })

  it('lets MANAGER through WITHOUT touching the database', async () => {
    const r = await run(requirePermission('anything_at_all'), { user: { id: 1, role: 'MANAGER' } })
    expect(r.outcome).toBe('next')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  // Regression: SUPER_ADMIN used to be DENIED here (stored ["all"] is not a
  // granular token). The bypass must not cost a DB round-trip either.
  it('lets SUPER_ADMIN through WITHOUT touching the database', async () => {
    const r = await run(requirePermission('pos_access'), { user: { id: 1, role: 'SUPER_ADMIN' } })
    expect(r.outcome).toBe('next')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('allows a role holding the permission', async () => {
    queryResult = { data: { permissions: ['pos_access', 'reports_view'] }, error: null }
    const r = await run(requirePermission('reports_view'), { user: { id: 50, role: 'CASHIER' } })
    expect(r.outcome).toBe('next')
  })

  it('denies a role lacking the permission with a coded 403', async () => {
    queryResult = { data: { permissions: ['dashboard_view'] }, error: null }
    const r = await run(requirePermission('reports_view'), { user: { id: 50, role: 'CASHIER' } })
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('PERMISSION_MISSING')
    expect(r.body.required).toEqual(['reports_view'])
  })

  it('parses legacy JSON-string permission columns', async () => {
    queryResult = { data: { permissions: '["reports_view"]' }, error: null }
    const r = await run(requirePermission('reports_view'), { user: { id: 2, role: 'CASHIER' } })
    expect(r.outcome).toBe('next')
  })

  it('treats corrupt permission JSON as no permissions', async () => {
    queryResult = { data: { permissions: 'not-json[' }, error: null }
    const r = await run(requirePermission('reports_view'), { user: { id: 2, role: 'CASHIER' } })
    expect(r.outcome).toBe('blocked')
  })

  it('401s when the user row is gone', async () => {
    queryResult = { data: null, error: { message: 'not found' } }
    const r = await run(requirePermission('pos_access'), { user: { id: 404, role: 'CASHIER' } })
    expect(r.status).toBe(401)
    expect(r.body.code).toBe('AUTH_USER_NOT_FOUND')
  })
})

describe('authenticateToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryResult = { data: null, error: null }
  })
  const sign = (payload) => generateToken(payload)
  const SESSION_CLAIMS = { id: 7, username: 'u', role: 'CASHIER', tenant_id: 35 }

  it('401s without a bearer token (coded)', async () => {
    const r = await run(authenticateToken, { headers: {} })
    expect(r.status).toBe(401)
    expect(r.body.code).toBe('AUTH_TOKEN_MISSING')
  })

  it('401s a garbage token as session death (coded)', async () => {
    const r = await run(authenticateToken, { headers: { authorization: 'Bearer not-a-jwt' } })
    expect(r.status).toBe(401)
    expect(r.body.code).toBe('AUTH_TOKEN_INVALID')
    expect(r.body.sessionExpired).toBe(true)
  })

  it('accepts a valid token with matching active session', async () => {
    queryResult = { data: ACTIVE_SESSION_USER, error: null }
    const token = sign({ ...SESSION_CLAIMS, session_token: 'sess-1' })
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    const next = jest.fn()
    await authenticateToken(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user.role).toBe('CASHIER')
    expect(req.user.tenantId).toBe(35)
  })

  it('403s a deactivated account as session death (coded)', async () => {
    queryResult = { data: { session_token: 'sess-1', is_active: false }, error: null }
    const token = sign({ ...SESSION_CLAIMS, session_token: 'sess-1' })
    const r = await run(authenticateToken, { headers: { authorization: `Bearer ${token}` } })
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('AUTH_ACCOUNT_DEACTIVATED')
    expect(r.body.sessionExpired).toBe(true)
  })

  it('401s a rotated session (another login)', async () => {
    queryResult = { data: { session_token: 'sess-NEW', is_active: true }, error: null }
    const token = sign({ ...SESSION_CLAIMS, session_token: 'sess-OLD' })
    const r = await run(authenticateToken, { headers: { authorization: `Bearer ${token}` } })
    expect(r.status).toBe(401)
    expect(r.body.code).toBe('AUTH_SESSION_ROTATED')
  })

  it('401s when the session was force-cleared', async () => {
    queryResult = { data: { session_token: null, is_active: true }, error: null }
    const token = sign({ ...SESSION_CLAIMS, session_token: 'sess-OLD' })
    const r = await run(authenticateToken, { headers: { authorization: `Bearer ${token}` } })
    expect(r.status).toBe(401)
    expect(r.body.code).toBe('AUTH_SESSION_CLEARED')
  })
})

// ---------------------------------------------------------------------------
// Structural guard inventory: every mutating route must be reachable only
// behind an authorization guard — either registered in-file or applied at
// mount time in index.js — except an explicit public allowlist. This is the
// regression net for "new endpoint shipped without permissions".
// ---------------------------------------------------------------------------
describe('route guard inventory', () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
  const routesDir = join(srcDir, 'routes')
  const indexSrc = readFileSync(join(srcDir, 'index.js'), 'utf8')

  // Router variable -> route file, via index.js imports (named or default)
  const varToFile = {}
  for (const m of indexSrc.matchAll(/import\s+(?:\{\s*([^}]+)\s*\}|([A-Za-z_$][\w$]*))\s+from\s+'\.\/routes\/([\w-]+\.js)'/g)) {
    const vars = (m[1] || m[2] || '').split(',')
    for (const v of vars) {
      const name = v.trim()
      if (name) varToFile[name] = m[3]
    }
  }

  // Middleware segment applied at each app.use() mount, per route file
  const mountGuards = {}
  for (const m of indexSrc.matchAll(/app\.use\('([^']*)',\s*([^)]*)\)/g)) {
    const vars = (m[2].match(/[A-Za-z_$][\w$]*/g) || [])
    const file = vars.map((v) => varToFile[v]).find(Boolean)
    if (file) mountGuards[file] = m[2]
  }

  // optionalAuthenticateToken deliberately does NOT count as a guard
  const GUARD = /authenticateToken|requireManager|requirePermission|requireSuperAdmin|requireRole/

  // Mutations reachable without ANY guard (by file + path).
  // paymob's webhook is called by Paymob's servers with an HMAC signature —
  // a JWT is impossible there; authenticity is verified inside the handler.
  const PUBLIC_ALLOWLIST = [
    ['auth.js', '/login'],
    ['auth.js', '/signup'],
    ['auth.js', '/bootstrap-superadmin'],
    ['paymob.js', '/webhook'],
  ]

  function mutationRegistrations(src) {
    const out = []
    const re = /router\.(post|put|patch|delete)\(\s*'([^']*)'([\s\S]{0,500}?)=>/g
    let m
    while ((m = re.exec(src)) !== null) {
      out.push({ verb: m[1].toUpperCase(), path: m[2], preamble: m[3] })
    }
    return out
  }

  it('has no publicly-reachable mutating routes outside the public allowlist', () => {
    const offenders = []
    for (const file of readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
      const src = readFileSync(join(routesDir, file), 'utf8')
      for (const r of mutationRegistrations(src)) {
        if (GUARD.test(r.preamble)) continue
        if (GUARD.test(mountGuards[file] || '')) continue
        if (PUBLIC_ALLOWLIST.some(([f, p]) => f === file && r.path === p)) continue
        offenders.push(`${file} ${r.verb} ${r.path}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps the strong guards on the sensitive surfaces', () => {
    const read = (f) => readFileSync(join(routesDir, f), 'utf8')
    expect(read('superAdmin.js')).toMatch(/requireSuperAdmin/)
    expect(read('users.js')).toMatch(/requirePermission\('user_manage'\)/)
    expect(read('employees.js')).toMatch(/requirePermission\('employees_edit'\)/)
    expect(read('walletPayments.js')).toMatch(/requireSuperAdmin/)
    expect(read('orders.js')).toMatch(/requirePermission\('pos_access'\)/)
    expect(read('backup.js')).toMatch(/requireSuperAdmin|isPlatformSuperAdmin/)
  })
})
