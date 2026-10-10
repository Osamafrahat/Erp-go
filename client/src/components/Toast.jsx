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
success:'bg-success-soft border-success text-success-soft-foreground',
error:'bg-danger-soft border-danger text-danger-soft-foreground',
warning:'bg-warning-soft border-warning text-warning-soft-foreground',
info:'bg-accent-soft border-accent text-accent-soft-foreground',
}

const iconColors = {
success:'text-success',
error:'text-danger',
warning:'text-warning',
info:'text-accent',
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
