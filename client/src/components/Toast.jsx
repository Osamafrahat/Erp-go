import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
}

const iconColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
}

export default function Toast() {
  const { toasts, removeToast } = useAppStore()
  const timersRef = useRef(new Map())

  // Arm a timer exactly once per toast, when it is added
  useEffect(() => {
    const timers = timersRef.current
    const activeIds = new Set(toasts.map(toast => toast.id))

    // Clear timers belonging to toasts that were removed manually
    timers.forEach((timerId, toastId) => {
      if (!activeIds.has(toastId)) {
        clearTimeout(timerId)
        timers.delete(toastId)
      }
    })

    toasts.forEach(toast => {
      if (toast.duration === 0 || timers.has(toast.id)) return // sticky toasts never auto-dismiss
      timers.set(toast.id, setTimeout(() => {
        timers.delete(toast.id)
        removeToast(toast.id)
      }, toast.duration || 4000))
    })
  }, [toasts, removeToast])

  // Clear every pending timer on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(timerId => clearTimeout(timerId))
      timers.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in ${colors[toast.type] || colors.info}`}
          >
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColors[toast.type] || iconColors.info}`} />
            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="font-semibold text-sm">{toast.title}</p>
              )}
              <p className="text-sm">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
