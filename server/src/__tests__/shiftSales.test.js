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

  it('matches the shift-close formula: opening_balance + total_sales', () => {
    const opening = 500
    const orders = [{ total: 120.5, payment_method: 'cash' }]
    const subs = [{ amount: 99.99, payment_method: 'card' }]

    const { total_sales } = summarizeShiftSales(orders, subs)

    expect(opening + total_sales).toBeCloseTo(720.49, 2)
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
    })
  })

  it('tolerates undefined input from a failed query', () => {
    expect(summarizeShiftSales(undefined, undefined).total_sales).toBe(0)
    expect(summarizeShiftSales(null, null).total_subscriptions).toBe(0)
  })
})
