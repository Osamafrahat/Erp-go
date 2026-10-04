import { describe, it, expect } from '@jest/globals'
import { summarizeShiftSales } from '../services/shiftSales.js'

describe('summarizeShiftSales', () => {
  it('includes subscription payments in total_sales (the cash box bug)', () => {
    // Regression: subscription sales post to subscription_payments and never
    // create an orders row, so summing orders alone omitted this money and
    // expected_cash came out low.
    const orders = [{ total: 100, payment_method: 'cash' }]
    const subs = [{ amount: 250, payment_method: 'cash' }]

    const result = summarizeShiftSales(orders, subs)

    expect(result.total_sales).toBe(350)
    expect(result.total_orders).toBe(1)
    expect(result.total_subscriptions).toBe(1)
  })

  it('matches the shift-close formula: opening_balance + net_cash', () => {
    // The drawer only ever held the cash order; the card subscription landed
    // in the bank, so reconciling the till against it was the bug.
    const opening = 500
    const orders = [{ total: 120.5, payment_method: 'cash' }]
    const subs = [{ amount: 99.99, payment_method: 'card' }]

    const { net_cash, total_sales } = summarizeShiftSales(orders, subs)

    expect(opening + net_cash).toBeCloseTo(620.5, 2)
    // total_sales stays on every method -- it reports what the shift sold,
    // not what the drawer holds.
    expect(total_sales).toBeCloseTo(220.49, 2)
  })

  it('counts only cash-method rows in total_cash, from both sources', () => {
    const orders = [
      { total: 100, payment_method: 'cash' },
      { total: 40, payment_method: 'card' },
      { total: 30, payment_method: 'mobile' },
    ]
    const subs = [
      { amount: 250, payment_method: 'cash' },
      { amount: 75, payment_method: 'credit' },
    ]

    const result = summarizeShiftSales(orders, subs)

    expect(result.total_cash).toBe(350) // 100 cash order + 250 cash sub
    expect(result.total_sales).toBe(495) // 170 orders + 325 subs
  })

  it('treats a missing or non-numeric amount as zero rather than NaN', () => {
    const result = summarizeShiftSales(
      [{ payment_method: 'cash' }, { total: 'not-a-number', payment_method: 'cash' }],
      [{ amount: undefined, payment_method: 'cash' }]
    )

    expect(result.total_sales).toBe(0)
    expect(result.total_cash).toBe(0)
    expect(result.total_orders).toBe(2)
    expect(result.total_subscriptions).toBe(1)
  })

  it('reads Supabase NUMERIC values that arrive as strings', () => {
    const result = summarizeShiftSales(
      [{ total: '150.75', payment_method: 'cash' }],
      [{ amount: '49.25', payment_method: 'cash' }]
    )

    expect(result.total_sales).toBe(200)
    expect(result.total_cash).toBe(200)
  })

  it('returns zeroes for an empty shift', () => {
    const result = summarizeShiftSales([], [])

    expect(result).toEqual({
      total_orders: 0,
      total_subscriptions: 0,
      total_sales: 0,
      total_cash: 0,
      cash_refunds: 0,
      net_cash: 0,
    })
  })

  it('tolerates undefined input from a failed query', () => {
    expect(summarizeShiftSales(undefined, undefined).total_sales).toBe(0)
    expect(summarizeShiftSales(null, null).total_subscriptions).toBe(0)
  })
})

describe('cash refunds', () => {
  it('takes cash refunds out of the drawer but leaves total_sales alone', () => {
    const orders = [
      { total: 100, payment_method: 'cash' },
      { total: 60, payment_method: 'card' },
    ]
    const refunds = [{ amount: 40, payment_method: 'cash' }]

    const result = summarizeShiftSales(orders, [], refunds)

    expect(result.total_cash).toBe(100) // takings, before refunds
    expect(result.cash_refunds).toBe(40)
    expect(result.net_cash).toBe(60) // what the drawer is expected to hold
    expect(result.total_sales).toBe(160) // revenue is unaffected
  })

  it('ignores refunds of non-cash orders -- that money never reached the drawer', () => {
    const refunds = [
      { amount: 25, payment_method: 'card' },
      { amount: 10, payment_method: 'mobile' },
      { amount: 5, payment_method: null },
    ]

    const result = summarizeShiftSales([], [], refunds)

    expect(result.cash_refunds).toBe(0)
    expect(result.net_cash).toBe(0)
  })

  it('lets the drawer reach zero when a refund exactly matches it', () => {
    // The accepted boundary: balance >= refund is allowed, so a refund equal
    // to the drawer empties it rather than being refused.
    const orders = [{ total: 80, payment_method: 'cash' }]
    const refunds = [{ amount: 80, payment_method: 'cash' }]

    expect(summarizeShiftSales(orders, [], refunds).net_cash).toBe(0)
  })

  it('goes negative when the refund out-runs this window (older order refunded)', () => {
    // Money left the drawer during this shift for an order sold in an earlier
    // one, so the shortfall has to show up here rather than not at all.
    const refunds = [{ amount: 30, payment_method: 'cash' }]

    expect(summarizeShiftSales([], [], refunds).net_cash).toBe(-30)
  })

  it('reads refund amounts that arrive as NUMERIC strings', () => {
    const refunds = [{ amount: '15.50', payment_method: 'cash' }]

    const result = summarizeShiftSales([], [], refunds)

    expect(result.cash_refunds).toBe(15.5)
    expect(result.net_cash).toBe(-15.5)
  })

  it('tolerates undefined refunds from a failed query', () => {
    expect(summarizeShiftSales([], [], undefined).cash_refunds).toBe(0)
    expect(summarizeShiftSales([], [], null).net_cash).toBe(0)
  })
})
