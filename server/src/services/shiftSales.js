// Pure aggregation for cash-shift takings.
//
// Kept free of any Supabase import so the arithmetic can be unit-tested
// directly -- this is the money that decides a shift's variance, and it was
// wrong for as long as it only counted `orders`.

/**
 * Summarise the two sources of drawer money for a shift window.
 *
 * `orders` and `subscriptionPayments` should already be filtered to the
 * tenant / time window (and to a cashier where the caller can scope them).
 *
 * Subscription sales are not optional here: quickCreate, renew and manual
 * payments all write to `subscription_payments` and never create an `orders`
 * row, so omitting them made expected_cash come out low and left every shift
 * that sold a subscription reconciling against a phantom positive variance.
 *
 * @param {Array<{total?: *, payment_method?: string}>} orders
 * @param {Array<{amount?: *, payment_method?: string}>} subscriptionPayments
 * @returns {{
 *   total_orders: number,
 *   total_subscriptions: number,
 *   total_sales: number,
 *   total_cash: number,
 * }}
 */
export function summarizeShiftSales(orders = [], subscriptionPayments = []) {
  const orderList = Array.isArray(orders) ? orders : []
  const subList = Array.isArray(subscriptionPayments) ? subscriptionPayments : []

  const sum = (list, field) =>
    list.reduce((total, row) => total + (parseFloat(row?.[field]) || 0), 0)

  const cashOrders = orderList.filter(o => o?.payment_method === 'cash')
  const cashSubs = subList.filter(p => p?.payment_method === 'cash')

  return {
    total_orders: orderList.length,
    total_subscriptions: subList.length,
    // Both columns are money that physically reached the drawer, so expected
    // cash must include them regardless of how the row was recorded.
    total_sales: sum(orderList, 'total') + sum(subList, 'amount'),
    total_cash: sum(cashOrders, 'total') + sum(cashSubs, 'amount'),
  }
}

export default summarizeShiftSales
