import { describe, it, expect } from 'vitest'
import { translateDescription } from '../lib/translateDescription'

const mockT = (key) => {
  const map = {
    'accounting.desc.arFor': 'دائن للطلب',
    'accounting.desc.paymentFor': 'دفعة للطلب',
    'accounting.desc.sale': 'بيع',
    'accounting.desc.vatFor': 'ضريبة للطلب',
    'accounting.desc.cogsFor': 'تكلفة البضاعة للطلب',
    'accounting.desc.expense': 'مصروف',
    'accounting.desc.stockIn': 'استلام',
    'accounting.desc.refundOrder': 'استرداد طلب',
    'accounting.desc.paymentReceived': 'دفعة مستلمة',
    'accounting.desc.paymentMade': 'دفعة صادرة',
  }
  return map[key] || key
}

describe('translateDescription', () => {
  it('returns empty string for falsy input', () => {
    expect(translateDescription(mockT, '')).toBe('')
    expect(translateDescription(mockT, null)).toBe('')
    expect(translateDescription(mockT, undefined)).toBe('')
  })

  it('translates "AR - " prefix', () => {
    const result = translateDescription(mockT, 'AR - John Doe')
    expect(result).toBe('دائن للطلب John Doe')
  })

  it('translates "Sale - " prefix', () => {
    const result = translateDescription(mockT, 'Sale - Order #123')
    expect(result).toBe('بيع Order #123')
  })

  it('translates "Payment for " prefix', () => {
    const result = translateDescription(mockT, 'Payment for Invoice #5')
    expect(result).toBe('دفعة للطلب Invoice #5')
  })

  it('translates "VAT for " prefix', () => {
    const result = translateDescription(mockT, 'VAT for Order #10')
    expect(result).toBe('ضريبة للطلب Order #10')
  })

  it('translates "COGS for " prefix', () => {
    const result = translateDescription(mockT, 'COGS for Product X')
    expect(result).toBe('تكلفة البضاعة للطلب Product X')
  })

  it('translates "Expense: " prefix', () => {
    const result = translateDescription(mockT, 'Expense: Office supplies')
    expect(result).toBe('مصروف Office supplies')
  })

  it('translates "Stock in: " prefix', () => {
    const result = translateDescription(mockT, 'Stock in: 50 units')
    expect(result).toBe('استلام 50 units')
  })

  it('returns already-translated Arabic text unchanged', () => {
    const result = translateDescription(mockT, 'بيع - طلب #123')
    expect(result).toBe('بيع - طلب #123')
  })

  it('returns text unchanged when no prefix matches', () => {
    const result = translateDescription(mockT, 'Random journal entry text')
    expect(result).toBe('Random journal entry text')
  })

  it('returns key when translation not found', () => {
    const noMatchT = (key) => key
    const result = translateDescription(noMatchT, 'AR - test')
    expect(result).toContain('AR -')
  })
})
