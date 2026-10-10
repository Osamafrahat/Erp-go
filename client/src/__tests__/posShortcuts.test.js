import { describe, it, expect } from 'vitest'
import { resolvePosShortcut, POS_SHORTCUTS } from '../lib/posShortcuts'

const ev = (key, opts = {}) => ({
  key,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: { tagName: 'DIV' },
  ...opts,
})
const typing = { tagName: 'INPUT' }

describe('resolvePosShortcut', () => {
  it('maps the F-keys', () => {
    expect(resolvePosShortcut(ev('F1'))).toBe('help')
    expect(resolvePosShortcut(ev('F2'))).toBe('focusBarcode')
    expect(resolvePosShortcut(ev('F3'))).toBe('focusSearch')
    expect(resolvePosShortcut(ev('F6'))).toBe('held')
    expect(resolvePosShortcut(ev('F8'))).toBe('clearCart')
    expect(resolvePosShortcut(ev('F9'))).toBe('scanner')
  })

  it('keeps modal-safe actions live while a modal is open and gates the rest', () => {
    const ctx = { modalOpen: true }
    expect(resolvePosShortcut(ev('F6'), ctx)).toBe('held')
    expect(resolvePosShortcut(ev('F2'), ctx)).toBe('focusBarcode')
    expect(resolvePosShortcut(ev('F3'), ctx)).toBe('focusSearch')
    expect(resolvePosShortcut(ev('F8'), ctx)).toBeNull()
    expect(resolvePosShortcut(ev('F9'), ctx)).toBeNull()
    expect(resolvePosShortcut(ev('ArrowDown'), ctx)).toBeNull()
  })

  it('lets Escape through everywhere — even mid-typing', () => {
    expect(resolvePosShortcut(ev('Escape'), { modalOpen: true })).toBe('escape')
    expect(resolvePosShortcut(ev('Escape', { target: typing }))).toBe('escape')
  })

  it('Alt combos reach through inputs; gated while a modal is open', () => {
    expect(resolvePosShortcut(ev('h', { altKey: true, code: 'KeyH', target: typing }))).toBe('hold')
    expect(resolvePosShortcut(ev('h', { altKey: true, code: 'KeyH' }))).toBe('hold')
    expect(resolvePosShortcut(ev('h', { altKey: true, code: 'KeyH' }), { modalOpen: true })).toBeNull()
    expect(resolvePosShortcut(ev('1', { altKey: true, code: 'Digit1' }))).toBe('tabProducts')
    expect(resolvePosShortcut(ev('2', { altKey: true, code: 'Digit2' }))).toBe('tabServices')
    expect(resolvePosShortcut(ev('3', { altKey: true, code: 'Digit3' }))).toBe('tabSubscriptions')
  })

  it('ignores plain letters and digits — they belong to the barcode field', () => {
    expect(resolvePosShortcut(ev('h'))).toBeNull()
    expect(resolvePosShortcut(ev('h', { target: typing }))).toBeNull()
    expect(resolvePosShortcut(ev('1', { target: typing }))).toBeNull()
    expect(resolvePosShortcut(ev('F', { target: typing }))).toBeNull()
  })

  it('cart row keys fire only bare and idle', () => {
    expect(resolvePosShortcut(ev('ArrowDown'))).toBe('rowDown')
    expect(resolvePosShortcut(ev('ArrowUp'))).toBe('rowUp')
    expect(resolvePosShortcut(ev('+'))).toBe('qtyUp')
    expect(resolvePosShortcut(ev('='))).toBe('qtyUp')
    expect(resolvePosShortcut(ev('-'))).toBe('qtyDown')
    expect(resolvePosShortcut(ev('Delete'))).toBe('removeRow')
    expect(resolvePosShortcut(ev('ArrowDown', { target: typing }))).toBeNull()
    expect(resolvePosShortcut(ev('+', { target: typing }))).toBeNull()
  })

  it('ignores auto-repeat and Ctrl/Cmd combos, including AltGr', () => {
    expect(resolvePosShortcut(ev('F6', { repeat: true }))).toBeNull()
    expect(resolvePosShortcut(ev('F6', { ctrlKey: true }))).toBeNull()
    expect(resolvePosShortcut(ev('F6', { metaKey: true }))).toBeNull()
    // AltGr arrives as ctrl+alt and must stay reserved for typing
    expect(resolvePosShortcut(ev('h', { altKey: true, ctrlKey: true, code: 'KeyH' }))).toBeNull()
  })

  it('never intercepts Enter — Cart and PaymentModal own it', () => {
    expect(resolvePosShortcut(ev('Enter'))).toBeNull()
    expect(resolvePosShortcut(ev('Enter', { target: typing }))).toBeNull()
  })

  it('every advertised shortcut has keys and a label', () => {
    expect(POS_SHORTCUTS.length).toBeGreaterThan(0)
    POS_SHORTCUTS.forEach((s) => {
      expect(Array.isArray(s.keys)).toBe(true)
      expect(s.keys.length).toBeGreaterThan(0)
      expect(typeof s.labelKey).toBe('string')
      expect(s.labelKey.startsWith('pos.shortcut')).toBe(true)
    })
  })
})
