import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { useAppStore } from '../stores/appStore'
import { authApi } from '../lib/api'
import { Lock, AlertTriangle, Check } from 'lucide-react'

export default function ForcePasswordChange() {
  const { logout } = useUserStore()
  const { t } = useAppStore()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError(t('password.minLength'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('password.noMatch'))
      return
    }

    if (currentPassword === newPassword) {
      setError(t('password.mustDiffer'))
      return
    }

    setLoading(true)

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword
      })

      setSuccess(true)

      setTimeout(() => {
        logout()
        navigate('/login')
      }, 2000)
    } catch (err) {
      const message = err.response?.data?.error || t('password.failedToChange')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
<div className="bg-surface rounded-2xl w-full max-w-md mx-4 shadow-2xl p-6 text-center">
<div className="w-16 h-16 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-4">
<Check className="w-8 h-8 text-success"/>
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('password.passwordChanged')}</h2>
<p className="text-muted">
            {t('password.passwordChangedMsg')}
          </p>
          <div className="mt-4">
<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto"></div>
<p className="text-sm text-muted mt-2">{t('password.redirecting')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
<div className="bg-surface rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
<div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-2">
<div className="p-2 bg-warning-soft rounded-lg">
<AlertTriangle className="w-6 h-6 text-warning"/>
            </div>
            <h2 className="text-xl font-semibold">{t('password.changeRequired')}</h2>
          </div>
<p className="text-muted text-sm">
            {t('password.changeRequiredMsg')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
<div className="p-3 bg-danger-soft text-danger-soft-foreground rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
<label className="block text-sm font-medium text-foreground mb-1">
              {t('password.currentPassword')}
            </label>
            <div className="relative">
<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"/>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-surface"
                placeholder={t('password.enterCurrent')}
                required
              />
            </div>
          </div>

          <div>
<label className="block text-sm font-medium text-foreground mb-1">
              {t('password.newPassword')}
            </label>
            <div className="relative">
<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"/>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-surface"
                placeholder={t('password.enterNew')}
                required
                minLength={6}
              />
            </div>
          </div>

          <div>
<label className="block text-sm font-medium text-foreground mb-1">
              {t('password.confirmPassword')}
            </label>
            <div className="relative">
<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"/>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-surface"
                placeholder={t('password.confirmNew')}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
className="flex-1 py-2 px-4 border border-border text-foreground rounded-lg bg-surface-hover transition-colors"
            >
              {t('password.logout')}
            </button>
            <button
              type="submit"
              disabled={loading}
className="flex-1 py-2 px-4 bg-accent text-white rounded-lg font-medium hover:bg-primary-700 bg-surface-tertiary disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('password.changing') : t('password.changePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
