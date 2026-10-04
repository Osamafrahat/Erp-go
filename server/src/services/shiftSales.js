// Pure aggregation for cash-shift takings.
//
// Kept free of any Supabase import so the arithmetic can be unit-tested
// directly -- this is the money that decides a shift's variance, and it was
// wrong for as long as it only counted `orders`.

/**
 * Summarise the money that belongs in a shift's drawer.
 *
 * `orders` and `subscriptionPayments` should already be filtered to the
 * tenant / time window (and to a cashier where the caller can scope them).
 *
 * Subscription sales are not optional here: quickCreate, renew and manual
 * payments all write to `subscription_payments` and never create an `orders`
 * row, so omitting them made expected_cash come out low and left every shift
 * that sold a subscription reconciling against a phantom positive variance.
 *
 * Refunds are the other side of the same coin: a cash refund takes notes
 * back out of the drawer, so `net_cash` -- and with it `expected_cash` --
 * has to give that money up again.
 *
 * @param {Array<{total?: *, payment_method?: string}>} orders
 * @param {Array<{amount?: *, payment_method?: string}>} subscriptionPayments
 * @param {Array<{amount?: *, payment_method?: string}>} refunds
 *   Refunds processed inside the window. A refund carries no payment method
 *   of its own -- `payment_method` is the method of the order being
 *   refunded, and only `cash` ones touch the drawer.
 * @returns {{
 *   total_orders: number,
 *   total_subscriptions: number,
 *   total_sales: number,
 *   total_cash: number,
 *   cash_refunds: number,
 *   net_cash: number,
 * }}
 */
export function summarizeShiftSales(orders = [], subscriptionPayments = [], refunds = []) {
  const orderList = Array.isArray(orders) ? orders : []
  const subList = Array.isArray(subscriptionPayments) ? subscriptionPayments : []
  const refundList = Array.isArray(refunds) ? refunds : []

  const sum = (list, field) =>
    list.reduce((total, row) => total + (parseFloat(row?.[field]) || 0), 0)

  const cashOrders = orderList.filter(o => o?.payment_method === 'cash')
  const cashSubs = subList.filter(p => p?.payment_method === 'cash')
  const cashRefunds = refundList.filter(r => r?.payment_method === 'cash')

  const totalCash = sum(cashOrders, 'total') + sum(cashSubs, 'amount')
  const totalCashRefunded = sum(cashRefunds, 'amount')

  return {
    total_orders: orderList.length,
    total_subscriptions: subList.length,
    // Revenue, kept on every method so the shift still reports what it sold.
    total_sales: sum(orderList, 'total') + sum(subList, 'amount'),
    // Cash that physically reached the drawer -- card and mobile takings
    // never did, so they must not be counted here.
    total_cash: totalCash,
    // Money handed back out of that same drawer during the window.
    cash_refunds: totalCashRefunded,
    // opening_balance + net_cash is the balance the drawer is expected to
    // hold right now.
    net_cash: totalCash - totalCashRefunded,
  }
}

export default summarizeShiftSales
