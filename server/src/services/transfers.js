import supabase from '../db/supabase.js'

// Stock transfers between branches. The heavy lifting (validation,
// row locking, stock movement, audit rows) happens inside the SQL
// function execute_stock_transfer() — one transaction, all-or-nothing,
// source product_stock row locked FOR UPDATE so two concurrent
// transfers can never both spend the same unit. This module owns the
// request-side pre-checks (fast, friendly 400s) and maps the function's
// raised codes back to API errors.

const ITEM_CODE_MAP = {
  BRANCH_SAME: 'BRANCH_SAME',
  BRANCH_EMPTY: 'BRANCH_EMPTY',
  BRANCH_INVALID: 'BRANCH_INVALID',
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
}

/**
 * Pure input validation — unit-testable without a DB. Runs BEFORE the SQL
 * function so bad requests never open a transaction; the function
 * re-validates everything anyway (defense in depth + race safety).
 *
 * @param {object} input
 * @param {number|string} input.fromBranchId
 * @param {number|string} input.toBranchId
 * @param {Array<{product_id?: *, quantity?: *}>} input.items
 * @param {Array<{id: *, is_active?: boolean}>} input.branches tenant-scoped branch rows for from/to
 * @param {Array<{product_id: *, quantity: *}>} input.stockRows product_stock rows at the source branch
 * @returns {{ok: true, items: Array<{product_id: number, quantity: number}>} | {ok: false, status: number, code: string, error: string}}
 */
export function validateTransferInput({ fromBranchId, toBranchId, items, branches, stockRows }) {
  const fromId = Number(fromBranchId)
  const toId = Number(toBranchId)

  if (!fromId || !toId) {
    return { ok: false, status: 400, code: 'BRANCH_INVALID', error: 'Both a source and a destination branch are required' }
  }
  if (fromId === toId) {
    return { ok: false, status: 400, code: 'BRANCH_SAME', error: 'Source and destination branches must differ' }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, code: 'BRANCH_EMPTY', error: 'Add at least one product to the transfer' }
  }

  const normalized = []
  for (const it of items) {
    const productId = Number(it?.product_id)
    const qty = Number(it?.quantity)
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return { ok: false, status: 400, code: 'BRANCH_INVALID', error: 'Each item needs a product and a quantity greater than zero' }
    }
    normalized.push({ product_id: productId, quantity: qty })
  }

  const from = (branches || []).find((b) => Number(b.id) === fromId)
  const to = (branches || []).find((b) => Number(b.id) === toId)
  if (!from || !to || from.is_active === false || to.is_active === false) {
    return { ok: false, status: 400, code: 'BRANCH_INVALID', error: 'One of the branches does not exist or is archived' }
  }

  const stockMap = {}
  ;(stockRows || []).forEach((r) => { stockMap[Number(r.product_id)] = Number(r.quantity) || 0 })
  for (const it of normalized) {
    if ((stockMap[it.product_id] || 0) < it.quantity) {
      return { ok: false, status: 400, code: 'STOCK_INSUFFICIENT', error: 'Insufficient stock at the source branch' }
    }
  }

  return { ok: true, items: normalized }
}

/** Maps a raised exception from execute_stock_transfer() to an API error. */
export function mapTransferError(errMessage = '') {
  for (const code of Object.keys(ITEM_CODE_MAP)) {
    if (errMessage.includes(code)) {
      const messages = {
        BRANCH_SAME: 'Source and destination branches must differ',
        BRANCH_EMPTY: 'Add at least one product to the transfer',
        BRANCH_INVALID: 'Selected branch does not exist',
        STOCK_INSUFFICIENT: 'Insufficient stock at the source branch',
      }
      return { status: 400, code, error: messages[code] }
    }
  }
  console.error('[TRANSFERS] execute_stock_transfer failed:', errMessage)
  return { status: 500, code: 'TRANSFER_FAILED', error: 'Stock transfer could not be completed' }
}

/**
 * Runs the atomic transfer. Throws nothing — returns
 * `{ ok: true, transferId }` or `{ ok: false, status, code, error }`.
 */
export async function executeTransfer({ tenantId, userId, fromBranchId, toBranchId, items, notes }) {
  const { data, error } = await supabase.rpc('execute_stock_transfer', {
    p_tenant_id: tenantId,
    p_from: fromBranchId,
    p_to: toBranchId,
    p_items: items,
    p_notes: notes || null,
    p_user_id: userId || null,
  })
  if (error) {
    const mapped = mapTransferError(error.message || '')
    return { ok: false, ...mapped }
  }
  return { ok: true, transferId: Number(data) }
}

/** The select shape used for both list and post-create fetch: transfer + items with product names. */
export const TRANSFER_SELECT = '*, stock_transfer_items(id, quantity, product:products(id, name, sku))'

export async function fetchTransfer(tenantId, transferId) {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select(TRANSFER_SELECT)
    .eq('id', transferId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) {
    console.error('[TRANSFERS] fetch failed:', error.message)
    return null
  }
  return data
}

export async function listTransfers(tenantId, limit = 50) {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select(TRANSFER_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[TRANSFERS] list failed:', error.message)
    return []
  }
  return data || []
}
