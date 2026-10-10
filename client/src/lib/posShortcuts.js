// Keyboard shortcuts for the POS — pure and DOM-free so the mapping can be
// unit tested. POS_SHORTCUTS is the single source of truth: the keydown
// resolver and the F1 help overlay both read it, so they cannot drift.
//
// Why function keys and Alt combos instead of plain letters: the barcode
// input is focused almost all the time, and barcode scanners are keyboard
// wedges that type characters + Enter at high speed. A plain "h" shortcut
// would land in the barcode field and fire a bogus scan. Scanners never
// send F-keys, Escape, or Alt — those are safe to bind globally.
//
// 'checkout' (Enter) is listed for the help overlay only: Cart owns
// Enter -> payment and PaymentModal owns Enter -> confirm, both through
// their own listeners. This resolver deliberately never returns it, so a
// third handler can never double-fire a sale.

export const POS_SHORTCUTS = [
  { id: 'escape', keys: ['Esc'], labelKey: 'pos.shortcutEscape' },
  { id: 'help', keys: ['F1'], labelKey: 'pos.shortcutHelp' },
  { id: 'focusBarcode', keys: ['F2'], labelKey: 'pos.shortcutBarcode' },
  { id: 'focusSearch', keys: ['F3'], labelKey: 'pos.shortcutSearch' },
  { id: 'held', keys: ['F6'], labelKey: 'pos.shortcutHeld' },
  { id: 'clearCart', keys: ['F8 ×2'], labelKey: 'pos.shortcutClear' },
  { id: 'scanner', keys: ['F9'], labelKey: 'pos.shortcutScanner' },
  { id: 'hold', keys: ['Alt', 'H'], labelKey: 'pos.shortcutHold' },
  { id: 'tabProducts', keys: ['Alt', '1'], labelKey: 'pos.shortcutTab1' },
  { id: 'tabServices', keys: ['Alt', '2'], labelKey: 'pos.shortcutTab2' },
  { id: 'tabSubscriptions', keys: ['Alt', '3'], labelKey: 'pos.shortcutTab3' },
  { id: 'checkout', keys: ['Enter'], labelKey: 'pos.shortcutCheckout' },
  { id: 'rowUp', keys: ['↑'], labelKey: 'pos.shortcutRowUp' },
  { id: 'rowDown', keys: ['↓'], labelKey: 'pos.shortcutRowDown' },
  { id: 'qtyUp', keys: ['+', '='], labelKey: 'pos.shortcutQtyUp' },
  { id: 'qtyDown', keys: ['-'], labelKey: 'pos.shortcutQtyDown' },
  { id: 'removeRow', keys: ['Del'], labelKey: 'pos.shortcutRemove' },
]

// Actions that stay live while a modal or dropdown is open (toggling or
// refocusing is harmless). Everything else is gated so F8 can't wipe the
// cart mid-payment or F9 can't open the scanner on top of the payment
// modal.
const MODAL_SAFE = new Set(['escape', 'help', 'focusBarcode', 'focusSearch', 'held'])

const FKEY_ACTIONS = {
  F1: 'help',
  F2: 'focusBarcode',
  F3: 'focusSearch',
  F6: 'held',
  F8: 'clearCart',
  F9: 'scanner',
}

function altAction(e) {
  // e.code is the physical key and stays stable under Alt/AltGr; e.key is
  // the fallback for environments without KeyboardEvent.code.
  const code = e.code || ''
  if (code === 'KeyH' || e.key === 'h' || e.key === 'H') return 'hold'
  if (code === 'Digit1' || e.key === '1') return 'tabProducts'
  if (code === 'Digit2' || e.key === '2') return 'tabServices'
  if (code === 'Digit3' || e.key === '3') return 'tabSubscriptions'
  return null
}

function isTypingTarget(target) {
  if (!target) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    !!target.isContentEditable
  )
}

export function resolvePosShortcut(e, ctx = {}) {
  if (!e || e.repeat) return null

  // Escape always resolves — closing the top window (or clearing the
  // search) must work from inside inputs too.
  if (e.key === 'Escape') return 'escape'

  // Ctrl/Cmd stay reserved for the browser (print, find, devtools...).
  // AltGr arrives as ctrl+alt, so this check also keeps it typing-safe.
  if (e.ctrlKey || e.metaKey) return null

  const fAction = FKEY_ACTIONS[e.key]
  if (fAction) return MODAL_SAFE.has(fAction) || !ctx.modalOpen ? fAction : null

  // Alt combos reach through inputs (a cashier can hold or switch tabs
  // while typing); scanners never send Alt.
  if (e.altKey) {
    const action = altAction(e)
    return action && !ctx.modalOpen ? action : null
  }

  // Bare keys only when nothing is being typed and no modal is open.
  if (ctx.modalOpen || isTypingTarget(e.target)) return null
  switch (e.key) {
    case 'ArrowUp':
      return 'rowUp'
    case 'ArrowDown':
      return 'rowDown'
    case '+':
    case '=':
      return 'qtyUp'
    case '-':
    case '_':
      return 'qtyDown'
    case 'Delete':
      return 'removeRow'
    default:
      return null
  }
}
