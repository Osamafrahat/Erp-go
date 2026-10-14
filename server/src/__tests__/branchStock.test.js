import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Supabase stub mirroring the real module's export surface (default-only
// client — see the incident note in passwordReset.test.js). Table results
// are queued: tables[name] = [first, second, ...] (last entry repeats).
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
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte', 'neq', 'or', 'range', 'not', 'single']) {
    chain[m] = jest.fn(() => chain)
  }
  chain.maybeSingle = jest.fn(() => Promise.resolve(tableResult(table)))
  // single() must NOT just return the chain — make it a terminal too, but
  // leave it chain-shaped for the chained terminals above by resolving via
  // the same queue. The chain's `single` here is the terminal one.
  chain.single = jest.fn(() => Promise.resolve(tableResult(table)))
  chain.insert = jest.fn((row) => { calls.push({ op: 'insert', table, row }); return chain })
  chain.update = jest.fn((payload) => { calls.push({ op: 'update', table, payload }); return chain })
  chain.delete = jest.fn(() => { calls.push({ op: 'delete', table }); return chain })
  // Real supabase builders are thenable at ANY point — code may `await` the
  // chain right after .in()/.eq() with no terminal call (overlay does).
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(tableResult(table)).then(onFulfilled, onRejected)
  return chain
})

jest.unstable_mockModule('../db/supabase.js', () => ({
  default: { from: fromSpy },
  supabaseStorage: { from: fromSpy },
  withTimeout: (p) => p,
}))

const { overlayBranchStock, adjustStock } = await import('../services/branchStock.js')

// Several cases assert logged failures — keep the suite output readable.
jest.spyOn(console, 'error').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  tables = {}
  calls = []
})

describe('overlayBranchStock', () => {
  // Fresh copies per test — overlay mutates rows IN PLACE by design, so a
  // shared array would leak state between tests.
  const freshProducts = () => [
    { id: 1, name: 'A', stock_quantity: 99 },
    { id: 2, name: 'B', stock_quantity: 50 },
  ]

  it('replaces totals with the branch quantity; no row at the branch = 0', async () => {
    tables.product_stock = { data: [{ product_id: 1, quantity: 7 }], error: null }
    const rows = await overlayBranchStock(freshProducts(), 10, 4)
    expect(rows[0].stock_quantity).toBe(7)
    expect(rows[1].stock_quantity).toBe(0) // branch holds none of B
  })

  it('is a no-op without a branch id (legacy tenant)', async () => {
    const rows = await overlayBranchStock(freshProducts(), 10, null)
    expect(rows[0].stock_quantity).toBe(99)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('does nothing on an empty product list', async () => {
    const rows = await overlayBranchStock([], 10, 4)
    expect(rows).toEqual([])
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('degrades to totals (and does not throw) when the read fails', async () => {
    tables.product_stock = { data: null, error: { message: 'boom' } }
    const rows = await overlayBranchStock(freshProducts(), 10, 4)
    expect(rows[0].stock_quantity).toBe(99)
    expect(rows[1].stock_quantity).toBe(50)
  })
})

describe('adjustStock', () => {
  it('routes through the adjust_product_stock RPC with named args', async () => {
    const rpcSpy = jest.fn(() => Promise.resolve({ data: 12, error: null }))
    const svc = await loadWithClient({ from: fromSpy, rpc: rpcSpy })

    const result = await svc.adjustStock({ tenantId: 10, branchId: 4, productId: 7, delta: -3 })
    expect(result).toBe(12)
    expect(rpcSpy).toHaveBeenCalledWith('adjust_product_stock', {
      p_tenant_id: 10,
      p_product_id: 7,
      p_branch_id: 4,
      p_delta: -3,
    })
  })

  it('returns null when the RPC errors (logged, never thrown)', async () => {
    const rpcSpy = jest.fn(() => Promise.resolve({ data: null, error: { message: 'fk violation' } }))
    const svc = await loadWithClient({ from: fromSpy, rpc: rpcSpy })
    const result = await svc.adjustStock({ tenantId: 10, branchId: 4, productId: 7, delta: 1 })
    expect(result).toBeNull()
  })

  it('falls back to the legacy total-only update when there is no branch', async () => {
    // products read: stock 5; legacy floor: max(0, 5 + -9) = 0
    tables.products = { data: { stock_quantity: 5 }, error: null }
    const svc = await loadWithClient({ from: fromSpy, rpc: jest.fn() })
    const result = await svc.adjustStock({ tenantId: 10, branchId: null, productId: 7, delta: -9 })
    expect(result).toBe(0)
    const upd = calls.find((c) => c.op === 'update' && c.table === 'products')
    expect(upd).toBeTruthy()
    expect(upd.payload.stock_quantity).toBe(0)
  })

  it('is a no-op without tenant or product', async () => {
    const svc = await loadWithClient({ from: fromSpy, rpc: jest.fn() })
    expect(await svc.adjustStock({ tenantId: null, branchId: 4, productId: 7, delta: 1 })).toBeNull()
    expect(await svc.adjustStock({ tenantId: 10, branchId: 4, productId: null, delta: 1 })).toBeNull()
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

// The module under test binds its supabase import at load time, so swap the
// client per-case by re-importing with a fresh registry entry.
async function loadWithClient(client) {
  jest.resetModules()
  jest.unstable_mockModule('../db/supabase.js', () => ({
    default: client,
    supabaseStorage: client,
    withTimeout: (p) => p,
  }))
  return import('../services/branchStock.js')
}
