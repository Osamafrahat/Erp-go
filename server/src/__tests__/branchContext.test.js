import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Supabase stub mirroring the real module's export surface. Table results
// are queued: tables[name] = [first, second, ...] (last entry repeats), so
// flows like "default missing -> insert -> re-read" can be sequenced.
let tables = {}
let calls = []

function tableResult(table) {
  const t = tables[table]
  if (t === undefined) return { data: null, error: null }
  if (Array.isArray(t)) {
    const v = t.length > 1 ? t.shift() : t[0]
    return v ?? { data: null, error: null }
  }
  return t
}

const fromSpy = jest.fn((table) => {
  const chain = {}
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'or']) {
    chain[m] = jest.fn(() => chain)
  }
  chain.maybeSingle = jest.fn(() => Promise.resolve(tableResult(table)))
  chain.single = jest.fn(() => Promise.resolve(tableResult(table)))
  chain.insert = jest.fn((row) => { calls.push({ op: 'insert', table, row }); return chain })
  chain.update = jest.fn((payload) => { calls.push({ op: 'update', table, payload }); return chain })
  chain.delete = jest.fn(() => { calls.push({ op: 'delete', table }); return chain })
  // Real supabase builders are thenable at ANY point — code may `await` the
  // chain right after .order() with no terminal call (listBranches does).
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(tableResult(table)).then(onFulfilled, onRejected)
  return chain
})

jest.unstable_mockModule('../db/supabase.js', () => ({
  default: { from: fromSpy },
  supabaseStorage: { from: fromSpy },
  withTimeout: (p) => p,
}))

const { ensureDefaultBranch, listBranches, resolveEffectiveBranch, resolveBranchParam } = await import('../services/branches.js')

const DEFAULT_ROW = { id: 1, tenant_id: 10, name: 'Main Branch', is_default: true, is_active: true }
// Queue entries are the full maybeSingle/single RESULT — a raw row must be
// wrapped: { data: ROW, error: null }.
const defaultResult = () => ({ data: DEFAULT_ROW, error: null })

// Several cases assert logged failures — keep the suite output readable.
jest.spyOn(console, 'error').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  tables = {}
  calls = []
})

describe('ensureDefaultBranch', () => {
  it('returns the existing default without writing', async () => {
    tables.branches = { data: DEFAULT_ROW, error: null }
    const row = await ensureDefaultBranch(10)
    expect(row).toEqual(DEFAULT_ROW)
    expect(calls).toEqual([])
  })

  it('creates Main Branch when the tenant has none', async () => {
    tables.branches = [
      { data: null, error: null }, // read: no default yet
      { data: DEFAULT_ROW, error: null }, // insert().select().single()
    ]
    const row = await ensureDefaultBranch(10)
    expect(row).toEqual(DEFAULT_ROW)
    const ins = calls.find((c) => c.op === 'insert' && c.table === 'branches')
    expect(ins.row).toMatchObject({ tenant_id: 10, name: 'Main Branch', is_default: true })
  })

  it('re-reads the winner when a concurrent request already created it', async () => {
    tables.branches = [
      { data: null, error: null }, // read: no default yet
      { data: null, error: { code: '23505', message: 'unique violation' } }, // insert lost the race
      { data: DEFAULT_ROW, error: null }, // retry read picks up the winner
    ]
    const row = await ensureDefaultBranch(10)
    expect(row).toEqual(DEFAULT_ROW)
  })

  it('returns null for a tenant-less caller', async () => {
    expect(await ensureDefaultBranch(null)).toBeNull()
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('listBranches', () => {
  it('returns tenant rows as-is (default ordering handled in SQL)', async () => {
    tables.branches = { data: [DEFAULT_ROW, { id: 2, tenant_id: 10, name: 'A' }], error: null }
    const rows = await listBranches(10)
    expect(rows).toHaveLength(2)
    expect(rows[0].is_default).toBe(true)
  })

  it('returns [] on read failure instead of throwing', async () => {
    tables.branches = { data: null, error: { message: 'boom' } }
    expect(await listBranches(10)).toEqual([])
  })
})

describe('resolveEffectiveBranch', () => {
  it('is null without a tenant (platform super admin)', async () => {
    const id = await resolveEffectiveBranch({ tenantId: null, userId: 35, role: 'SUPER_ADMIN', headerBranchId: 9 })
    expect(id).toBeNull()
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('manager + valid active header -> that branch (no users lookup)', async () => {
    tables.branches = { data: { id: 5, tenant_id: 10, is_active: true }, error: null }
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 46, role: 'MANAGER', headerBranchId: 5 })
    expect(id).toBe(5)
    expect(fromSpy).not.toHaveBeenCalledWith('users')
  })

  it('manager + header from ANOTHER tenant falls back to the default', async () => {
    tables.branches = [
      { data: { id: 5, tenant_id: 99, is_active: true }, error: null }, // header: foreign tenant
      defaultResult(), // fallback read
    ]
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 46, role: 'MANAGER', headerBranchId: 5 })
    expect(id).toBe(1)
  })

  it('manager + archived header branch falls back to the default', async () => {
    tables.branches = [
      { data: { id: 5, tenant_id: 10, is_active: false }, error: null },
      defaultResult(),
    ]
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 46, role: 'MANAGER', headerBranchId: 5 })
    expect(id).toBe(1)
  })

  it('manager without header -> default, never reading users', async () => {
    tables.branches = { data: DEFAULT_ROW, error: null }
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 46, role: 'MANAGER', headerBranchId: null })
    expect(id).toBe(1)
    expect(fromSpy).not.toHaveBeenCalledWith('users')
  })

  it('cashier without a pin -> default', async () => {
    tables.users = { data: { branch_id: null }, error: null }
    tables.branches = { data: DEFAULT_ROW, error: null }
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 50, role: 'CASHIER', headerBranchId: null })
    expect(id).toBe(1)
  })

  it('cashier pinned to a home branch -> that branch', async () => {
    tables.users = { data: { branch_id: 7 }, error: null }
    tables.branches = { data: { id: 7, tenant_id: 10, is_active: true }, error: null }
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 50, role: 'CASHIER', headerBranchId: null })
    expect(id).toBe(7)
  })

  it('cashier header is IGNORED (pinned users cannot wander)', async () => {
    tables.branches = { data: { id: 7, tenant_id: 10, is_active: true }, error: null }
    tables.users = { data: { branch_id: 7 }, error: null }
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 50, role: 'CASHIER', headerBranchId: 3 })
    expect(id).toBe(7)
    // The header was never consulted: resolution ran through the users
    // home-pin lookup, which is only reachable when the header is ignored.
    expect(fromSpy).toHaveBeenCalledWith('users')
  })

  it('pinned home that went foreign/inactive falls back to default', async () => {
    tables.users = { data: { branch_id: 7 }, error: null }
    tables.branches = [
      { data: { id: 7, tenant_id: 99, is_active: true }, error: null }, // home validation: foreign
      defaultResult(), // fallback
    ]
    const id = await resolveEffectiveBranch({ tenantId: 10, userId: 50, role: 'CASHIER', headerBranchId: null })
    expect(id).toBe(1)
  })
})

describe('resolveBranchParam', () => {
  it('treats absent/empty as a clear (ok, null)', async () => {
    expect(await resolveBranchParam(10, undefined)).toEqual({ ok: true, value: null })
    expect(await resolveBranchParam(10, null)).toEqual({ ok: true, value: null })
    expect(await resolveBranchParam(10, '')).toEqual({ ok: true, value: null })
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('rejects a branch outside the tenant', async () => {
    tables.branches = { data: { id: 5, tenant_id: 99 }, error: null }
    expect(await resolveBranchParam(10, 5)).toEqual({ ok: false })
  })

  it('rejects a non-numeric id without a read', async () => {
    expect(await resolveBranchParam(10, 'abc')).toEqual({ ok: false })
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('accepts a branch of this tenant', async () => {
    tables.branches = { data: { id: 5, tenant_id: 10 }, error: null }
    expect(await resolveBranchParam(10, '5')).toEqual({ ok: true, value: 5 })
  })
})
