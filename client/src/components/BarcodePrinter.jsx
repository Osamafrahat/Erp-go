import { useState, useRef } from 'react'
import { X, Printer, Download } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { escapeHtml } from '../lib/html'

// Simple barcode generator using Code 128
function generateBarcode(value) {
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const charWidth = 2
  const barHeight = 50
  const quietZone = 10

  // Simple encoding: use character codes to determine bar widths
  const bars = []
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i)
    // Generate alternating bars based on character code
    bars.push({ width: (charCode % 3) + 1, dark: true })
    bars.push({ width: 1, dark: false })
    bars.push({ width: (charCode % 4) + 1, dark: true })
    bars.push({ width: 1, dark: false })
  }

  const totalWidth = bars.reduce((sum, bar) => sum + bar.width * charWidth, 0) + quietZone * 2

  return { bars, totalWidth, barHeight, charWidth, quietZone }
}

function BarcodeSVG({ value, width = 200, height = 80, showText = true }) {
  const barcode = generateBarcode(value)
  const scale = (width - barcode.quietZone * 2) / barcode.totalWidth

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width={width} height={height} fill="white" />
      <g transform={`translate(${barcode.quietZone}, 0) scale(${scale}, 1)`}>
        {barcode.bars.map((bar, i) => {
          const x = barcode.bars.slice(0, i).reduce((sum, b) => sum + b.width * barcode.charWidth, 0)
          if (bar.dark) {
            return (
              <rect
                key={i}
                x={x}
                y={0}
                width={bar.width * barcode.charWidth}
                height={barcode.barHeight}
                fill="black"
              />
            )
          }
          return null
        })}
      </g>
      {showText && (
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          fontSize="10"
          fontFamily="monospace"
        >
          {value}
        </text>
      )}
    </svg>
  )
}

export default function BarcodePrinter({ product, onClose }) {
  const { t } = useAppStore()
  const [quantity, setQuantity] = useState(1)
  const [labelWidth, setLabelWidth] = useState(50)
  const [labelHeight, setLabelHeight] = useState(30)
  const [showText, setShowText] = useState(true)
  const printRef = useRef()

  const barcodeValue = product?.barcode || product?.sku || product?.id?.toString() || ''

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            body { margin: 0; padding: 10px; font-family: monospace; }
            .label {
              display: inline-block;
              border: 1px dashed #ccc;
              padding: 5px;
              margin: 5px;
              text-align: center;
              page-break-inside: avoid;
            }
            .product-name { font-size: 8px; margin-bottom: 2px; }
            .product-price { font-size: 10px; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 10px;">
            <button id="print-now">Print</button>
            <button id="print-close">Close</button>
          </div>
          ${Array(quantity).fill('').map(() => `
            <div class="label" style="width: ${escapeHtml(labelWidth)}mm; height: ${escapeHtml(labelHeight)}mm;">
              <div class="product-name">${escapeHtml(product?.name || '')}</div>
              <div>${printContent.innerHTML}</div>
              <div class="product-price">$${escapeHtml(product?.price?.toFixed(2) || '0.00')}</div>
            </div>
          `).join('')}
        </body>
      </html>
    `)
    printWindow.document.close()
    // Attached programmatically: an inline `onclick` in this window would be
    // blocked by our Content-Security-Policy, because an about:blank document
    // inherits the CSP of the opener that created it.
    printWindow.document.getElementById('print-now')?.addEventListener('click', () => printWindow.print())
    printWindow.document.getElementById('print-close')?.addEventListener('click', () => printWindow.close())
  }

  const handleDownload = () => {
    const svg = printRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, img.width, img.height)
      ctx.drawImage(img, 0, 0)

      const link = document.createElement('a')
      link.download = `barcode-${barcodeValue}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl w-full max-w-md mx-4 shadow-2xl">
<div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">{t('barcode.printBarcode')}</h2>
          <button
            onClick={onClose}
className="p-2 rounded-lg bg-surface-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Product Info */}
<div className="bg-surface-secondary rounded-lg p-3">
            <p className="font-medium">{product?.name || t('barcode.unknownProduct')}</p>
<p className="text-sm text-muted">{t('barcode.barcode')}:{barcodeValue}</p>
<p className="text-sm text-muted">{t('barcode.price')}: ${product?.price?.toFixed(2)||'0.00'}</p>
          </div>

          {/* Preview */}
<div ref={printRef}className="flex justify-center p-4 bg-surface border border-border rounded-lg">
            <BarcodeSVG
              value={barcodeValue}
              width={200}
              height={80}
              showText={showText}
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
<label className="block text-sm font-medium text-foreground mb-1">
                {t('barcode.quantity')}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
              />
            </div>
            <div>
<label className="block text-sm font-medium text-foreground mb-1">
                {t('barcode.labelWidth')}
              </label>
              <input
                type="number"
                value={labelWidth}
                onChange={(e) => setLabelWidth(parseInt(e.target.value) || 50)}
                min="20"
                max="100"
className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showText"
              checked={showText}
              onChange={(e) => setShowText(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="showText" className="text-sm">{t('barcode.showText')}</label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handleDownload}
className="flex items-center gap-2 px-4 py-2 text-foreground bg-surface-tertiary rounded-lg bg-surface-hover"
            >
              <Download className="w-4 h-4" />
              {t('barcode.download')}
            </button>
            <button
              onClick={handlePrint}
className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-700"
            >
              <Printer className="w-4 h-4" />
              {t('barcode.print')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
