import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { X, Camera, Keyboard, Check, Loader2 } from 'lucide-react'

export default function BarcodeScanner({ onScan, onClose }) {
  const { t } = useAppStore()
  const [mode, setMode] = useState('manual')
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [lastScanned, setLastScanned] = useState('')
  const [lastProductName, setLastProductName] = useState('')
  const [flash, setFlash] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastScanRef = useRef('')
  const lastScanTimeRef = useRef(0)
  const detectorRef = useRef(null)

  useEffect(() => {
    if (mode === 'manual') {
      inputRef.current?.focus()
    }
  }, [mode])

  useEffect(() => {
    return () => {
      stopCamera()
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

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    detectorRef.current.detectFromVideo(videoRef.current).then(barcodes => {
      if (barcodes.length > 0) {
        const barcode = barcodes[0].rawValue
        if (barcode) {
          handleScanResult(barcode)
        }
      }
    }).catch(() => {})

    animFrameRef.current = requestAnimationFrame(scanFrame)
  }, [handleScanResult])

  const startCamera = async () => {
    try {
      setCameraLoading(true)
      setCameraError('')
      setMode('camera')

      // Check if BarcodeDetector is natively supported, otherwise use @zxing/library
      let useNative = 'BarcodeDetector' in window

      if (useNative) {
        // Try native BarcodeDetector
        try {
          const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] })
          detectorRef.current = { detectFromVideo: (video) => detector.detect(video) }
        } catch (e) {
          useNative = false
        }
      }

      if (!useNative) {
        const { BrowserMultiFormatReader } = await import('@zxing/library')
        const reader = new BrowserMultiFormatReader()
        detectorRef.current = {
          detectFromVideo: async (video) => {
            try {
              const result = await reader.decodeOnceFromVideoDevice(undefined, video)
              return result ? [{ rawValue: result.getText() }] : []
            } catch (e) {
              return []
            }
          }
        }
      }

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream

      // Wait for DOM
      await new Promise(resolve => setTimeout(resolve, 100))

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsScanning(true)
        setCameraLoading(false)
        // Start scanning loop
        animFrameRef.current = requestAnimationFrame(scanFrame)
      }
    } catch (err) {
      console.error('Camera error:', err)
      setIsScanning(false)
      setCameraLoading(false)
      setMode('manual')
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.')
      } else {
        setCameraError(err.message || 'Could not access camera')
      }
    }
  }

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    detectorRef.current = null
    setIsScanning(false)
  }

  const switchToManual = () => {
    stopCamera()
    setMode('manual')
    setCameraError('')
  }

  const switchToCamera = () => {
    stopCamera()
    startCamera()
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
              stopCamera()
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
              onClick={switchToManual}
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
              onClick={switchToCamera}
              disabled={cameraLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${
                mode === 'camera'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {cameraLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {t('scanner.camera')}
            </button>
          </div>
        </div>

        {/* Scanner Content */}
        <div className="p-4">
          {mode === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {cameraError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{cameraError}</p>
                </div>
              )}
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
              <div className="relative w-full h-64 bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-white/50 rounded-lg">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />
                    <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-primary-500/70 animate-pulse" />
                  </div>
                </div>
              </div>
              {cameraLoading && (
                <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              )}
              {isScanning && (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p className="animate-pulse">{t('scanner.pointCamera')}</p>
                  <p className="text-xs mt-1">{t('scanner.continuousMode')}</p>
                </div>
              )}
              <button
                onClick={switchToManual}
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
