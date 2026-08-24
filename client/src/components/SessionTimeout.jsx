import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { useAppStore } from '../stores/appStore'
import { AlertTriangle, Clock } from 'lucide-react'

const WARNING_TIME = 5 * 60 * 1000 // Show warning 5 minutes before timeout
const CHECK_INTERVAL = 30 * 1000 // Check every 30 seconds

export default function SessionTimeout() {
  const { isAuthenticated, lastActivity, logout, updateActivity, checkSessionTimeout, mustChangePassword } = useUserStore()
  const { t } = useAppStore()
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [remainingTime, setRemainingTime] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)

  // Track user activity
  const handleActivity = useCallback(() => {
    if (isAuthenticated) {
      updateActivity()
      setShowWarning(false)
    }
  }, [isAuthenticated, updateActivity])

  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated) return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => document.addEventListener(event, handleActivity, { passive: true }))

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity))
    }
  }, [isAuthenticated, handleActivity])

  // Check for session timeout
  useEffect(() => {
    if (!isAuthenticated || !lastActivity) return
    if (mustChangePassword()) return

    const interval = setInterval(() => {
      const timedOut = checkSessionTimeout()
      if (timedOut) {
        navigate('/login')
        return
      }

      // Calculate remaining time
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity
      const remaining = Math.max(0, 30 * 60 * 1000 - timeSinceLastActivity)
      setRemainingTime(Math.floor(remaining / 1000))

      // Show warning when 5 minutes or less remaining
      if (remaining <= WARNING_TIME && remaining > 0) {
        setShowWarning(true)
      } else {
        setShowWarning(false)
      }
    }, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [isAuthenticated, lastActivity, checkSessionTimeout, navigate, mustChangePassword])

  const handleLogout = () => {
    if (loggingOut) return
    setLoggingOut(true)
    logout()
    navigate('/login')
  }

  const handleStayLoggedIn = () => {
    updateActivity()
    setShowWarning(false)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!showWarning || !isAuthenticated) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold">{t('session.expiring')}</h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('session.expiringMessage')}
        </p>

        <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Clock className="w-5 h-5 text-gray-500" />
          <span className="text-lg font-mono font-semibold text-amber-600">
            {formatTime(remainingTime)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('session.remaining')}</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('users.signOut')}
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            {t('session.stayLoggedIn')}
          </button>
        </div>
      </div>
    </div>
  )
}
