import { AlertTriangle, Info, X } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

export default function ConfirmModal({ open, onClose, onConfirm, title, message, type = 'danger', confirmText, cancelText, loading }) {
  const { t } = useAppStore()
  if (!open) return null

  const resolvedConfirmText = confirmText || t('common.confirm') || 'Confirm'
  const resolvedCancelText = cancelText || t('common.cancel') || 'Cancel'

  const styles = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6" />,
iconBg:'bg-danger-soft',
iconColor:'text-danger',
confirmBtn:'bg-danger hover:bg-red-700 text-white',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6" />,
iconBg:'bg-warning-soft',
iconColor:'text-warning',
confirmBtn:'bg-warning hover:bg-yellow-700 text-white',
    },
    info: {
      icon: <Info className="w-6 h-6" />,
iconBg:'bg-accent-soft',
iconColor:'text-accent',
confirmBtn:'bg-accent hover:bg-blue-700 text-white',
    },
  }

  const s = styles[type] || styles.danger

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
<div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <button
          onClick={onClose}
className="absolute top-4 end-4 p-1 rounded-lg bg-surface-hover text-muted text-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-2xl ${s.iconBg} flex items-center justify-center mx-auto mb-4`}>
            <div className={s.iconColor}>{s.icon}</div>
          </div>
<h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
<p className="text-sm text-muted leading-relaxed">{message}</p>
        </div>

<div className="flex gap-3 p-4 bg-surface-secondary">
          <button
            onClick={onClose}
            disabled={loading}
className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground bg-surface-hover font-medium text-sm transition-colors disabled:opacity-50"
          >
            {resolvedCancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${s.confirmBtn}`}
          >
{loading &&<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
