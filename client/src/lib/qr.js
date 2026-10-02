import QRCode from 'qrcode'

/**
 * Render text as a PNG data URL, entirely in the browser.
 *
 * Receipts used to render their ETA QR by calling api.qrserver.com, which
 * pushed the receipt's tax data (store tax ID, totals, ETA UUID) to a third
 * party and produced no QR at all whenever the till was offline — exactly
 * when a compliant receipt mattered most. Generating the code locally removes
 * both the data leak and the network dependency.
 *
 * Never throws: a receipt without a QR is better than a failed print.
 */
export async function qrDataUrl(text, width = 240) {
  if (!text) return ''
  try {
    return await QRCode.toDataURL(String(text), {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch (err) {
    console.error('[QR] Failed to generate QR code:', err.message)
    return ''
  }
}
