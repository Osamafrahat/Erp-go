import supabase from '../db/supabase.js'

// Per-branch stock reads/writes. Writes go through the SQL function
// adjust_product_stock(), which floors the branch row at 0 (matching the
// legacy Math.max(0, ...) semantics) and recomputes products.stock_quantity
// from ALL branch rows — the total = sum(branches) invariant holds by
// construction, so every legacy reader of stock_quantity stays correct.

/**
 * Overlays per-branch quantities onto fetched product rows IN PLACE:
 * stock_quantity becomes what the GIVEN branch holds; a product with no
 * product_stock row at that branch becomes 0 (the branch holds none).
 * No-op when branchId is null (legacy/tenant-less) or rows are empty.
 */
export async function overlayBranchStock(products, tenantId, branchId) {
  if (!branchId || !tenantId || !products?.length) return products || []

  const ids = products.map((p) => p.id)
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, quantity')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .in('product_id', ids)
  if (error) {
    // Degrade to TOTALS rather than failing the page — flagged loudly.
    console.error('[BRANCH_STOCK] overlay load failed:', error.message)
    return products
  }

  const map = {}
  ;(data || []).forEach((r) => { map[r.product_id] = Number(r.quantity) || 0 })
  products.forEach((p) => { p.stock_quantity = map[p.id] ?? 0 })
  return products
}

/**
 * Applies a signed stock delta to ONE branch. Returns the branch's new
 * quantity, or null on failure (logged).
 *
 * When branchId is null (tenant without any branch — should not happen
 * post-backfill, but self-healing can fail), falls back to the legacy
 * direct-total update so behavior degrades to exactly what shipped before
 * multi-branch existed.
 */
export async function adjustStock({ tenantId, branchId, productId, delta }) {
  if (!tenantId || !productId) return null
  const d = Number(delta) || 0

  if (!branchId) {
    const { data: p, error: readErr } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (readErr || !p) {
      console.error('[BRANCH_STOCK] legacy adjust read failed:', readErr?.message)
      return null
    }
    const next = Math.max(0, (Number(p.stock_quantity) || 0) + d)
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: next, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('tenant_id', tenantId)
    if (error) {
      console.error('[BRANCH_STOCK] legacy adjust failed:', error.message)
      return null
    }
    return next
  }

  const { data, error } = await supabase.rpc('adjust_product_stock', {
    p_tenant_id: tenantId,
    p_product_id: productId,
    p_branch_id: branchId,
    p_delta: d,
  })
  if (error) {
    console.error('[BRANCH_STOCK] adjust_product_stock failed:', error.message)
    return null
  }
  return Number(data)
}
