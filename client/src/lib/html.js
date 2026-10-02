// HTML escaping for strings that end up in a `document.write()` template.
//
// React escapes its own JSX children, but the print flows (ReceiptModal,
// BarcodePrinter, AccountingReportsPage) bypass React and interpolate raw
// database values straight into an HTML string, then write it into a
// `window.open('', '_blank')` window. That window is `about:blank`, which
// inherits the opener's origin -- so a script running there can read the
// session token. A product name or store setting containing
// `<img src=x onerror=...>` is therefore a stored XSS, not a cosmetic bug.
//
// Escaping at the sink is what makes the whole template safe regardless of
// where the value came from.

/**
 * Escape a value for use in HTML text or in a quoted attribute.
 * `&` must be replaced first so we never double-escape our own entities.
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default escapeHtml
