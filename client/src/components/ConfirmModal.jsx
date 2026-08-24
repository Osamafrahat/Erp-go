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
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6" />,
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    },
    info: {
      icon: <Info className="w-6 h-6" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  }

  const s = styles[type] || styles.danger

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-2xl ${s.iconBg} flex items-center justify-center mx-auto mb-4`}>
            <div className={s.iconColor}>{s.icon}</div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {resolvedCancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${s.confirmBtn}`}
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
