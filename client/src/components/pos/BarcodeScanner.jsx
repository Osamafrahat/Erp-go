import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { X, Camera, Keyboard, Check } from 'lucide-react'

export default function BarcodeScanner({ onScan, onClose }) {
  const { t } = useAppStore()
  const [mode, setMode] = useState('manual')
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [lastScanned, setLastScanned] = useState('')
  const [lastProductName, setLastProductName] = useState('')
  const [flash, setFlash] = useState(false)
  const inputRef = useRef(null)
  const scannerRef = useRef(null)
  const lastScanRef = useRef('')
  const lastScanTimeRef = useRef(0)

  useEffect(() => {
    if (mode === 'manual') {
      inputRef.current?.focus()
    }
  }, [mode])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const handleScanResult = useCallback(async (barcode) => {
    const now = Date.now()
    if (barcode === lastScanRef.current && now - lastScanTimeRef.current < 2000) return
    lastScanRef.current = barcode
    lastScanTimeRef.current = now

    setLastScanned(barcode)
    setLastProductName('')
    setScanCount(prev => prev + 1)
    setFlash(true)
    setTimeout(() => setFlash(false), 300)
    const name = await onScan(barcode)
    if (name) setLastProductName(name)
  }, [onScan])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (manualInput.trim()) {
      handleScanResult(manualInput.trim())
      setManualInput('')
      inputRef.current?.focus()
    }
  }

  const startCameraScanner = async () => {
    try {
      setMode('camera')
      setIsScanning(true)

      const { Html5Qrcode } = await import('html5-qrcode')

      const scanner = new Html5Qrcode('barcode-scanner')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanResult(decodedText)
        },
        () => {}
      )
    } catch (err) {
      console.error('Camera scanner error:', err)
      setIsScanning(false)
      setMode('manual')
      alert(t('scanner.cameraError'))
    }
  }

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setIsScanning(false)
    setMode('manual')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl transition-all ${flash ? 'ring-4 ring-green-400' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{t('scanner.title')}</h2>
            {scanCount > 0 && (
              <span className="px-2.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm font-bold">
                {scanCount} {scanCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              stopCameraScanner()
              onClose()
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Last Scanned Feedback */}
        {lastScanned && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <div className="min-w-0">
                {lastProductName && (
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300 truncate">{lastProductName}</p>
                )}
                <span className="text-xs text-green-600 dark:text-green-500">
                  {lastScanned}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="p-4">
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              onClick={() => {
                stopCameraScanner()
                setMode('manual')
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${
                mode === 'manual'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              {t('scanner.manual')}
            </button>
            <button
              onClick={startCameraScanner}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${
                mode === 'camera'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Camera className="w-4 h-4" />
              {t('scanner.camera')}
            </button>
          </div>
        </div>

        {/* Scanner Content */}
        <div className="p-4">
          {mode === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('scanner.enterBarcode')}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={t('scanner.barcodePlaceholder')}
                  className="w-full px-4 py-3 text-lg rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {t('scanner.add')} {manualInput.trim() ? `(${manualInput.trim()})` : ''}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div
                id="barcode-scanner"
                className="w-full h-64 bg-gray-900 rounded-lg overflow-hidden"
              />
              {isScanning && (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p className="animate-pulse">{t('scanner.pointCamera')}</p>
                  <p className="text-xs mt-1">{t('scanner.continuousMode')}</p>
                </div>
              )}
              <button
                onClick={stopCameraScanner}
                className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t('scanner.cancelCamera')}
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="px-4 pb-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>{t('scanner.tip')}</strong> {t('scanner.continuousTip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
