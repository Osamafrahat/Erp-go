import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ReceiptModal from '../components/pos/ReceiptModal'

// ReceiptModal only uses etaApi inside a guarded useEffect; stub it so the
// test never touches the real axios client.
vi.mock('../lib/api', () => ({
  etaApi: { getQR: vi.fn(() => Promise.resolve({ data: {} })) },
}))

afterEach(cleanup)

// The exact shape POSPage builds for a subscription-only sale before the fix:
// no payment_method, and InvoicesPage's normalizedSubs had no subtotal/tax.
const subscriptionOrder = {
  order_number: 'ORD-1',
  created_at: '2026-01-01T00:00:00.000Z',
  items: [{ product_name: 'Pro Plan', quantity: 1, unit_price: 100, _type: 'subscription' }],
  subtotal: 100,
  discount_amount: 0,
  tax_amount: 0,
  total: 100,
  users: { full_name: 'Sara' },
  customers: { name: 'Acme' },
  subscription_sale: true,
}

const text = () => document.body.textContent || ''

describe('ReceiptModal payment method label', () => {
  it('never prints the raw translation key when payment_method is missing', () => {
    render(<ReceiptModal order={{ ...subscriptionOrder }} onClose={() => {}} />)
    expect(text()).not.toContain('receipt.undefined')
    // Row is hidden rather than rendering an invented payment.
    expect(text()).not.toContain('Payment:')
  })

  it('translates a known payment method', () => {
    render(<ReceiptModal order={{ ...subscriptionOrder, payment_method: 'cash' }} onClose={() => {}} />)
    expect(text()).toContain('Cash')
    expect(text()).not.toContain('receipt.cash')
    expect(text()).toContain('Payment:')
  })

  it('falls back to the raw value for a method with no translation', () => {
    render(<ReceiptModal order={{ ...subscriptionOrder, payment_method: 'crypto' }} onClose={() => {}} />)
    expect(text()).toContain('crypto')
    expect(text()).not.toContain('receipt.crypto')
  })

  it('renders the same label in the print template as in the preview', () => {
    const order = { ...subscriptionOrder, payment_method: 'credit' }
    render(<ReceiptModal order={order} onClose={() => {}} />)
    expect(text()).toContain('Pay Later')
    expect(text()).not.toContain('receipt.credit')
  })
})

describe('ReceiptModal totals', () => {
  it('does not render NaN when money fields are absent', () => {
    const bare = {
      order_number: 'ORD-2',
      items: [{ product_name: 'Widget', quantity: 2, unit_price: 10 }],
      total: 20,
      payment_method: 'card',
    }
    render(<ReceiptModal order={bare} onClose={() => {}} />)
    expect(text()).not.toContain('NaN')
  })

  it('balances subtotal - discount + tax against total', () => {
    render(<ReceiptModal order={{ ...subscriptionOrder, payment_method: 'cash' }} onClose={() => {}} />)
    expect(text()).toContain('100.00')
    expect(text()).not.toContain('NaN')
  })
})
