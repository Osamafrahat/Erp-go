import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { X, AlertTriangle, ArrowUpRight } from 'lucide-react'

export default function PlanLimitModal() {
  const { t } = useAppStore()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      setDetail(e.detail)
      setShow(true)
    }
    window.addEventListener('plan-limit-reached', handler)
    return () => window.removeEventListener('plan-limit-reached', handler)
  }, [])

  if (!show || !detail) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setShow(false)}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 relative text-center" onClick={e => e.stopPropagation()}>
        <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-orange-500" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {t('limits.title') || 'Plan Limit Reached'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {detail.resource || 'Resource'}: {detail.current}/{detail.limit}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {t('limits.upgradeMessage') || 'Upgrade your plan to continue adding more.'}
        </p>

        <button
          onClick={() => { setShow(false); navigate('/pricing') }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          {t('limits.upgradeNow') || 'Upgrade Plan'}
        </button>

        <button
          onClick={() => setShow(false)}
          className="w-full mt-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {t('limits.dismiss') || 'Dismiss'}
        </button>
      </div>
    </div>
  )
}
