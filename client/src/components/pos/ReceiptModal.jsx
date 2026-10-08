import { useAppStore } from '../../stores/appStore'
import { formatCurrency, formatDateTime } from '../../lib/utils'
import { Printer, X, Wrench } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { etaApi } from '../../lib/api'
import { escapeHtml } from '../../lib/html'
import { qrDataUrl } from '../../lib/qr'

export default function ReceiptModal({ order, onClose }) {
  const { settings, t } = useAppStore()
  const receiptRef = useRef(null)
  const [etaQR, setEtaQR] = useState(order.eta_qr_code || '')
  // Locally rendered PNG for the ETA QR. Kept out of etaQR so the raw content
  // stays available and the image can be re-rendered at print time.
  const [etaQRImage, setEtaQRImage] = useState('')

  // t() returns the key itself when a lookup misses (appStore), so a missing or
  // unrecognised payment_method would print literally as "receipt.undefined".
  // Known methods are translated, unknown ones fall back to the raw value, and
  // an absent one hides the row rather than inventing a payment.
  const paymentMethodLabel = (() => {
    const method = order.payment_method
    if (!method) return ''
    const key = `receipt.${method}`
    const label = t(key)
    return label === key ? method : label
  })()

  useEffect(() => {
    if (!etaQR && settings.eta_auto_submit !== 'disabled' && order.id) {
      etaApi.getQR(order.id).then(res => {
        if (res.data?.qrContent) setEtaQR(res.data.qrContent)
      }).catch(() => {})
    }
  }, [order.id])

  // Render the ETA QR locally whenever its content changes. No network call,
  // so this also works with the till offline.
  useEffect(() => {
    let stale = false
    if (!etaQR) {
      setEtaQRImage('')
      return undefined
    }
    qrDataUrl(etaQR).then(url => {
      if (!stale) setEtaQRImage(url)
    })
    return () => {
      stale = true
    }
  }, [etaQR])

  const handlePrint = async () => {
    // Open synchronously, before any await: window.open after a tick loses
    // user activation and gets caught by popup blockers.
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    // Regenerate instead of reusing state, so a print triggered the instant
    // the QR arrives still carries it.
    const qrImage = etaQR ? await qrDataUrl(etaQR) : ''
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${escapeHtml(order.order_number)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 5mm;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .store-name { font-size: 18px; font-weight: bold; font-family: 'Georgia', 'Times New Roman', serif; letter-spacing: 1px; }
          .store-info { font-size: 10px; color: #666; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .item-row { margin: 5px 0; }
          .item-name { font-weight: bold; }
          .item-details { font-size: 10px; color: #666; }
          .total-row { font-weight: bold; font-size: 14px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; }
          @media print {
            body { width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${settings.storeLogo ? `<img src="${escapeHtml(settings.storeLogo)}" alt="Logo" style="max-height: 60px; max-width: 60px; margin: 0 auto 5px;" />` : ''}
          <div class="store-name">${escapeHtml(settings.storeName)}</div>
          ${settings.storeAddress ? `<div class="store-info">${escapeHtml(settings.storeAddress)}</div>` : ''}
          ${settings.storePhone ? `<div class="store-info">${escapeHtml(settings.storePhone)}</div>` : ''}
        </div>
        <div class="divider"></div>
        <div class="row">
          <span>${t('receipt.orderNumber')}:</span>
          <span>${escapeHtml(order.order_number)}</span>
        </div>
        <div class="row">
          <span>${t('receipt.date')}:</span>
          <span>${formatDateTime(order.created_at || new Date())}</span>
        </div>
        ${order.users?.full_name ? `
          <div class="row">
            <span>${t('receipt.cashier')}</span>
            <span>${escapeHtml(order.users.full_name)}</span>
          </div>
        ` : ''}
        <div class="divider"></div>
        <div style="font-weight: bold; margin-bottom: 5px;">${t('receipt.items')}:</div>
        ${order.items.map(item => `
          <div class="item-row">
            <div class="row">
              <span class="item-name">${escapeHtml(item.product_name || item.products?.name || item.name || t('receipt.unknownItem'))}${item._type === 'service' ? ' [SVC]' : ''}</span>
              <span>${escapeHtml(formatCurrency(item.unit_price * item.quantity, settings.currencySymbol))}</span>
            </div>
            <div class="item-details">
              ${item.quantity} x ${escapeHtml(formatCurrency(item.unit_price, settings.currencySymbol))}
            </div>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div class="row">
          <span>${t('receipt.subtotal')}:</span>
          <span>${escapeHtml(formatCurrency(order.subtotal ?? 0, settings.currencySymbol))}</span>
        </div>
        ${order.discount_amount > 0 ? `
          <div class="row" style="color: green;">
            <span>${t('receipt.discount')}:</span>
            <span>-${escapeHtml(formatCurrency(order.discount_amount, settings.currencySymbol))}</span>
          </div>
        ` : ''}
        <div class="row">
          <span>${t('receipt.tax')} (${escapeHtml(settings.taxRate)}%):</span>
          <span>${escapeHtml(formatCurrency(order.tax_amount ?? 0, settings.currencySymbol))}</span>
        </div>
        <div class="divider"></div>
        <div class="row total-row">
          <span>${t('receipt.total')}:</span>
          <span>${escapeHtml(formatCurrency(order.total ?? 0, settings.currencySymbol))}</span>
        </div>
        <div class="divider"></div>
        ${paymentMethodLabel ? `
        <div class="row">
          <span>${t('receipt.payment')}:</span>
          <span>${escapeHtml(paymentMethodLabel)}</span>
        </div>
        ` : ''}
        ${order.payment_method === 'cash' && order.change > 0 ? `
          <div class="row">
            <span>${t('receipt.change')}:</span>
            <span>${escapeHtml(formatCurrency(order.change, settings.currencySymbol))}</span>
          </div>
        ` : ''}
        <div class="divider"></div>
        <div class="footer">
          ${escapeHtml(settings.receiptFooter || t('receipt.thankYou'))}
        </div>
        ${qrImage ? `
          <div style="text-align: center; margin-top: 10px;">
            <img src="${qrImage}" alt="ETA QR" width="120" height="120" />
            <div style="font-size: 8px; color: #666; margin-top: 4px;">Scan for ETA receipt</div>
          </div>
        ` : ''}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
<div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">{t('payment.printReceipt')}</h2>
          <button
            onClick={onClose}
className="p-2 rounded-lg bg-surface-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div ref={receiptRef} className="p-4">
<div className="bg-surface border border-border rounded-lg p-6 font-mono text-sm text-foreground">
            {/* Store Header */}
            <div className="text-center mb-4">
              {settings.storeLogo && (
                <img src={settings.storeLogo} alt={settings.storeName} className="mx-auto h-16 w-16 object-contain mb-2" />
              )}
              <h3 className="text-lg font-bold" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: '1px' }}>{settings.storeName}</h3>
              {settings.storeAddress && (
<p className="text-muted text-xs">{settings.storeAddress}</p>
              )}
              {settings.storePhone && (
<p className="text-muted text-xs">{settings.storePhone}</p>
              )}
            </div>

<hr className="border-dashed border-border my-3"/>

            {/* Order Info */}
            <div className="flex justify-between mb-1">
<span className="text-muted">{t('receipt.orderNumber')}:</span>
              <span className="font-semibold">{order.order_number}</span>
            </div>
            <div className="flex justify-between mb-1">
<span className="text-muted">{t('receipt.date')}:</span>
              <span>{formatDateTime(order.created_at || new Date())}</span>
            </div>
            {order.users?.full_name && (
              <div className="flex justify-between mb-3">
<span className="text-muted">{t('receipt.cashier')}:</span>
                <span>{order.users.full_name}</span>
              </div>
            )}

<hr className="border-dashed border-border my-3"/>

            {/* Items */}
            <div className="font-semibold mb-2">{t('receipt.items')}:</div>
            {order.items.map((item, index) => (
              <div key={index} className="mb-2">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {item.product_name || item.products?.name || item.name}
                    {item._type === 'service' && (
<span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-accent-soft text-accent-soft-foreground">SVC</span>
                    )}
                  </span>
                  <span>{formatCurrency(item.unit_price * item.quantity, settings.currencySymbol)}</span>
                </div>
<div className="text-muted text-xs">
                  {item.quantity} x {formatCurrency(item.unit_price, settings.currencySymbol)}
                </div>
              </div>
            ))}

<hr className="border-dashed border-border my-3"/>

            {/* Totals */}
            <div className="flex justify-between mb-1">
<span className="text-muted">{t('receipt.subtotal')}:</span>
              <span>{formatCurrency(order.subtotal ?? 0, settings.currencySymbol)}</span>
            </div>
            {order.discount_amount > 0 && (
<div className="flex justify-between mb-1 text-success">
                <span>{t('receipt.discount')}:</span>
                <span>-{formatCurrency(order.discount_amount, settings.currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
<span className="text-muted">{t('receipt.tax')}({settings.taxRate}%):</span>
              <span>{formatCurrency(order.tax_amount ?? 0, settings.currencySymbol)}</span>
            </div>

<hr className="border-dashed border-border my-3"/>

            {/* Total */}
            <div className="flex justify-between text-lg font-bold">
              <span>{t('receipt.total')}:</span>
              <span>{formatCurrency(order.total ?? 0, settings.currencySymbol)}</span>
            </div>

<hr className="border-dashed border-border my-3"/>

            {/* Payment */}
            {paymentMethodLabel && (
              <div className="flex justify-between mb-1">
<span className="text-muted">{t('receipt.payment')}:</span>
                <span>{paymentMethodLabel}</span>
              </div>
            )}
            {order.payment_method === 'cash' && order.change > 0 && (
              <div className="flex justify-between">
<span className="text-muted">{t('receipt.change')}:</span>
                <span>{formatCurrency(order.change, settings.currencySymbol)}</span>
              </div>
            )}

<hr className="border-dashed border-border my-3"/>

            {/* Footer */}
<div className="text-center text-xs text-muted">
              {settings.receiptFooter || t('receipt.thankYou')}
            </div>

            {/* ETA QR Code */}
            {etaQRImage && (
              <div className="text-center mt-4">
                <img
                  src={etaQRImage}
                  alt="ETA QR"
                  className="mx-auto"
                  width={120}
                  height={120}
                />
<p className="text-[10px] text-muted mt-1">Scan for ETA receipt</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
<div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
className="flex-1 py-3 bg-surface-tertiary text-foreground rounded-lg font-medium bg-surface-hover"
          >
            {t('common.close')}
          </button>
          <button
            onClick={handlePrint}
className="flex-1 py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-700 flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            {t('payment.printReceipt')}
          </button>
        </div>
      </div>
    </div>
  )
}
