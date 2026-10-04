// The physical drawer: which shift is open, what has gone in and out of it,
// and therefore what it is expected to hold right now.
//
// Lives apart from shiftSales.js on purpose -- that module stays free of any
// Supabase import so the arithmetic can be unit-tested directly. This is the
// layer that goes and fetches the rows it is handed.

import supabase from '../db/supabase.js'
import { summarizeShiftSales } from './shiftSales.js'

// Drawer money belonging to a shift window, from both sources of takings.
//
// Subscription sales never create an `orders` row -- quickCreate, renew and
// manual payments all write to `subscription_payments` instead -- so summing
// `orders` alone made that money invisible: expected_cash came out low and
// the shift closed with a phantom positive variance. Only one shift may be
// open per tenant (POST /cash-shifts), so tenant + opened_at is a sound
// attribution even though subscription_payments carries no user_id of its own.
//
// Refunds are deliberately NOT scoped to `userId`. There is one drawer per
// tenant, and a refund processed by anyone -- an admin at the back office,
// say -- takes cash out of that drawer; hiding it from the till's figures
// would only re-open the variance bug.
async function getShiftSales(tenantId, openedAt, closedAt = null, userId = null) {
  let orderQuery = supabase
    .from('orders')
    .select('total, payment_method')
    .eq('tenant_id', tenantId)
    .gte('created_at', openedAt)

  // `orders` knows who rang the sale, so keep the per-cashier filter where the
  // caller had one. subscription_payments has no user column to filter on.
  if (userId) orderQuery = orderQuery.eq('user_id', userId)

  let subQuery = supabase
    .from('subscription_payments')
    .select('amount, payment_method')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid')
    .gte('created_at', openedAt)

  // A refund empties the drawer when it is processed, so it is attributed to
  // the window it happened in -- not the window the refunded order was sold in.
  // `payment_method` rides along from the refunded order; refunds have none.
  let refundQuery = supabase
    .from('refunds')
    .select('amount, created_at, orders(payment_method)')
    .eq('tenant_id', tenantId)
    .gte('created_at', openedAt)

  if (closedAt) {
    orderQuery = orderQuery.lte('created_at', closedAt)
    subQuery = subQuery.lte('created_at', closedAt)
    refundQuery = refundQuery.lte('created_at', closedAt)
  }

  const [{ data: orders, error: ordersError }, { data: subs, error: subsError }, { data: refunds, error: refundsError }] =
    await Promise.all([orderQuery, subQuery, refundQuery])

  if (ordersError) console.error('[SHIFT SALES] Orders query failed:', ordersError.message)
  if (subsError) console.error('[SHIFT SALES] Subscription payments query failed:', subsError.message)
  if (refundsError) console.error('[SHIFT SALES] Refunds query failed:', refundsError.message)

  // Flatten the PostgREST join so summarizeShiftSales keeps seeing plain rows.
  const refundList = (refunds || []).map(r => ({
    amount: r.amount,
    payment_method: r.orders?.payment_method ?? null,
  }))

  return {
    ok: !ordersError && !subsError && !refundsError,
    ...summarizeShiftSales(orders || [], subs || [], refundList),
  }
}

// The tenant's open drawer, or null if nobody has opened one.
async function getOpenCashShift(tenantId) {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[CASH BOX] Open shift lookup failed:', error.message)
    return null
  }
  return data || null
}

/**
 * What the open drawer is expected to hold right now.
 *
 * Scoped to the shift owner's sales (matching what that till shows on
 * /active/stats), with every cash refund the tenant has processed since the
 * drawer was opened taken back out.
 *
 * @returns {Promise<{
 *   shift: object|null,
 *   sales: object|null,
 *   balance: number,
 *   ok: boolean,
 * }>}
 *   `shift` is null when no cash box is open. `ok` is false when a source
 *   query failed, in which case `balance` is a placeholder: a missing row
 *   would overstate the drawer, and overstating it is what lets a refund
 *   overdraw.
 */
async function getCashBoxBalance(tenantId) {
  const shift = await getOpenCashShift(tenantId)
  if (!shift) return { shift: null, sales: null, balance: 0, ok: false }

  const sales = await getShiftSales(tenantId, shift.opened_at, null, shift.user_id)
  const ok = !!sales.ok
  const balance = ok
    ? (parseFloat(shift.opening_balance) || 0) + (sales.net_cash || 0)
    : 0

  return { shift, sales, balance, ok }
}

export { getShiftSales, getOpenCashShift, getCashBoxBalance }
