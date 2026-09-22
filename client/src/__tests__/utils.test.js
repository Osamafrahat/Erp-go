import { describe, it, expect } from 'vitest'
import { cn, formatCurrency, formatDate, formatDateTime, generateOrderNumber, generateSKU, calculateChange, getLocale } from '../lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })
  it('resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
  it('handles falsy values', () => {
    expect(cn('foo', false, null, undefined)).toBe('foo')
  })
})

describe('formatCurrency', () => {
  it('formats with default EGP currency', () => {
    const result = formatCurrency(1234.5)
    expect(result).toContain('1,234.50')
    expect(result).toContain('ج.م')
  })
  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0.00')
  })
  it('formats negative amounts', () => {
    const result = formatCurrency(-500)
    expect(result).toContain('-500.00')
  })
  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(10.678)).toContain('10.68')
  })
  it('handles string input', () => {
    expect(formatCurrency('99.9')).toContain('99.90')
  })
})

describe('generateOrderNumber', () => {
  it('starts with ORD-', () => {
    expect(generateOrderNumber()).toMatch(/^ORD-/)
  })
  it('generates unique values', () => {
    const a = generateOrderNumber()
    const b = generateOrderNumber()
    expect(a).not.toBe(b)
  })
})

describe('generateSKU', () => {
  it('returns 8 character string', () => {
    expect(generateSKU()).toHaveLength(8)
  })
  it('contains only uppercase letters and digits', () => {
    expect(generateSKU()).toMatch(/^[A-Z0-9]{8}$/)
  })
  it('generates unique values', () => {
    const skus = new Set(Array.from({ length: 100 }, () => generateSKU()))
    expect(skus.size).toBeGreaterThan(1)
  })
})

describe('calculateChange', () => {
  it('calculates correct change', () => {
    expect(calculateChange(200, 150)).toBe(50)
  })
  it('returns 0 when tendered less than total', () => {
    expect(calculateChange(50, 100)).toBe(0)
  })
  it('handles exact change', () => {
    expect(calculateChange(100, 100)).toBe(0)
  })
  it('rounds to 2 decimals', () => {
    expect(calculateChange(100.005, 99.001)).toBe(1)
  })
  it('handles floating point edge case', () => {
    expect(calculateChange(0.3, 0.1)).toBe(0.2)
  })
})

describe('getLocale', () => {
  it('returns ar-EG for Arabic', () => {
    expect(getLocale('ar')).toBe('ar-EG')
  })
  it('returns en-EG for English', () => {
    expect(getLocale('en')).toBe('en-EG')
  })
  it('defaults to en-EG for unknown', () => {
    expect(getLocale('fr')).toBe('en-EG')
  })
})

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-06-15')
    expect(result).toContain('Jun')
    expect(result).toContain('15')
    expect(result).toContain('2025')
  })
})

describe('formatDateTime', () => {
  it('formats a datetime string', () => {
    const result = formatDateTime('2025-06-15T14:30:00')
    expect(result).toContain('Jun')
    expect(result).toContain('2025')
  })
})
