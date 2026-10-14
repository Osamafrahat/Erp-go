import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// validateTransferInput and mapTransferError are pure — only module load
// needs the supabase mock. executeTransfer's error mapping is exercised
// through a controllable rpc stub.
const rpcSpy = jest.fn()

jest.unstable_mockModule('../db/supabase.js', () => ({
  default: { from: jest.fn(), rpc: rpcSpy },
  supabaseStorage: { from: jest.fn() },
  withTimeout: (p) => p,
}))

const { validateTransferInput, mapTransferError, executeTransfer } = await import('../services/transfers.js')

const BRANCHES = [
  { id: 1, is_active: true },
  { id: 2, is_active: true },
  { id: 3, is_active: false },
]
const STOCK_ROWS = [{ product_id: 7, quantity: 10 }]

const happyInput = (overrides = {}) => ({
  fromBranchId: 1,
  toBranchId: 2,
  items: [{ product_id: 7, quantity: 4 }],
  branches: BRANCHES,
  stockRows: STOCK_ROWS,
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('validateTransferInput', () => {
  it('accepts a valid transfer and normalizes ids/quantities to numbers', () => {
    const res = validateTransferInput(
      happyInput({ fromBranchId: '1', items: [{ product_id: '7', quantity: '4' }] })
    )
    expect(res).toEqual({
      ok: true,
      items: [{ product_id: 7, quantity: 4 }],
    })
  })

  it('allows spending exactly the branch balance', () => {
    const res = validateTransferInput(happyInput({ items: [{ product_id: 7, quantity: 10 }] }))
    expect(res.ok).toBe(true)
  })

  it('rejects a missing source or destination', () => {
    expect(validateTransferInput(happyInput({ fromBranchId: 0 })).code).toBe('BRANCH_INVALID')
    expect(validateTransferInput(happyInput({ toBranchId: undefined })).code).toBe('BRANCH_INVALID')
  })

  it('rejects same-branch transfers', () => {
    const res = validateTransferInput(happyInput({ toBranchId: 1 }))
    expect(res).toMatchObject({ ok: false, status: 400, code: 'BRANCH_SAME' })
  })

  it('rejects an empty item list', () => {
    expect(validateTransferInput(happyInput({ items: [] })).code).toBe('BRANCH_EMPTY')
    expect(validateTransferInput(happyInput({ items: undefined })).code).toBe('BRANCH_EMPTY')
  })

  it('rejects malformed items (no product, zero/negative/NaN quantity)', () => {
    expect(
      validateTransferInput(happyInput({ items: [{ product_id: 7, quantity: 0 }] })).code
    ).toBe('BRANCH_INVALID')
    expect(
      validateTransferInput(happyInput({ items: [{ product_id: 7, quantity: -2 }] })).code
    ).toBe('BRANCH_INVALID')
    expect(
      validateTransferInput(happyInput({ items: [{ quantity: 4 }] })).code
    ).toBe('BRANCH_INVALID')
    expect(
      validateTransferInput(happyInput({ items: [{ product_id: 7 }] })).code
    ).toBe('BRANCH_INVALID')
  })

  it('rejects unknown or archived branches', () => {
    expect(validateTransferInput(happyInput({ toBranchId: 99 })).code).toBe('BRANCH_INVALID')
    expect(validateTransferInput(happyInput({ toBranchId: 3 })).code).toBe('BRANCH_INVALID')
  })

  it('rejects spending more than the source branch holds', () => {
    const res = validateTransferInput(happyInput({ items: [{ product_id: 7, quantity: 11 }] }))
    expect(res).toMatchObject({ ok: false, status: 400, code: 'STOCK_INSUFFICIENT' })
  })

  it('treats a product with no row at the source branch as quantity 0', () => {
    const res = validateTransferInput(
      happyInput({ items: [{ product_id: 9, quantity: 1 }] })
    )
    expect(res.code).toBe('STOCK_INSUFFICIENT')
  })
})

describe('mapTransferError', () => {
  it.each([
    ['BRANCH_SAME'],
    ['BRANCH_EMPTY'],
    ['BRANCH_INVALID'],
    ['STOCK_INSUFFICIENT'],
  ])('maps raised %s to a 400 with that code', (code) => {
    const res = mapTransferError(`null value in column "x" (${code})`)
    expect(res).toMatchObject({ status: 400, code })
    expect(typeof res.error).toBe('string')
  })

  it('maps unknown failures to a 500 TRANSFER_FAILED (and logs)', () => {
    const res = mapTransferError('permission denied for function execute_stock_transfer')
    expect(res).toEqual({
      status: 500,
      code: 'TRANSFER_FAILED',
      error: 'Stock transfer could not be completed',
    })
    expect(console.error).toHaveBeenCalled()
  })
})

describe('executeTransfer', () => {
  const base = {
    tenantId: 10,
    userId: 46,
    fromBranchId: 1,
    toBranchId: 2,
    items: [{ product_id: 7, quantity: 4 }],
    notes: 'restock',
  }

  it('calls the SQL function with named args and returns the transfer id', async () => {
    rpcSpy.mockResolvedValueOnce({ data: 42, error: null })
    const res = await executeTransfer(base)
    expect(rpcSpy).toHaveBeenCalledWith('execute_stock_transfer', {
      p_tenant_id: 10,
      p_from: 1,
      p_to: 2,
      p_items: [{ product_id: 7, quantity: 4 }],
      p_notes: 'restock',
      p_user_id: 46,
    })
    expect(res).toEqual({ ok: true, transferId: 42 })
  })

  it('maps raised SQL codes to 400 API errors', async () => {
    rpcSpy.mockResolvedValueOnce({
      data: null,
      error: { message: 'STOCK_INSUFFICIENT: not enough at source' },
    })
    const res = await executeTransfer(base)
    expect(res).toMatchObject({ ok: false, status: 400, code: 'STOCK_INSUFFICIENT' })
  })

  it('falls back to a generic 500 for unexpected SQL failures', async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: 'connection lost' } })
    const res = await executeTransfer(base)
    expect(res).toMatchObject({ ok: false, status: 500, code: 'TRANSFER_FAILED' })
  })
})
