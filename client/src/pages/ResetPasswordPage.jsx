import { Alert, Button, Card, InputGroup } from '@heroui/react'
import { Store, Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import api from '../lib/api'

// Mirrors the server's rules (auth.js /reset-password validators).
function validatePassword(pw) {
  if (pw.length < 8) return 'auth.reset.len'
  if (!/[a-z]/.test(pw)) return 'auth.reset.lower'
  if (!/[A-Z]/.test(pw)) return 'auth.reset.upper'
  if (!/[0-9]/.test(pw)) return 'auth.reset.number'
  return null
}

export default function ResetPasswordPage() {
  const { t, settings } = useAppStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const ruleError = validatePassword(password)
    if (ruleError) {
      setError(t(ruleError))
      return
    }
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'))
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      const code = err.response?.data?.code
      if (code === 'AUTH_RESET_TOKEN_INVALID') {
        setError(t('auth.reset.invalidToken'))
      } else if (code === 'AUTH_PASSWORD_WEAK') {
        setError(err.response?.data?.error || t('auth.reset.len'))
      } else {
        setError(t('auth.reset.failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-background dark:to-background-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-2xl mb-4 overflow-hidden">
            {settings.storeLogo ? (
              <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-10 h-10 text-accent-foreground" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{settings.storeName || 'ERP-GO'}</h1>
          <p className="text-muted mt-2">{t('auth.reset.subtitle')}</p>
        </div>

        <Card>
          <Card.Content className="p-6 sm:p-8">
            {!token ? (
              <div className="text-center space-y-4">
                <Alert status="danger" className="text-start">
                  <Alert.Indicator>
                    <AlertCircle className="size-5" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>{t('auth.reset.missingToken')}</Alert.Description>
                  </Alert.Content>
                </Alert>
                <Link to="/forgot-password">
                  <Button variant="primary" fullWidth>{t('auth.forgot.submit')}</Button>
                </Link>
              </div>
            ) : done ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto text-success" />
                <h2 className="text-lg font-semibold text-foreground">{t('auth.reset.successTitle')}</h2>
                <p className="text-sm text-muted">{t('auth.reset.successBody')}</p>
                <Link to="/login">
                  <Button variant="primary" fullWidth>{t('auth.forgot.backToLogin')}</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <Alert status="danger" className="text-start">
                    <Alert.Indicator>
                      <AlertCircle className="size-5" />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                <div>
                  <label htmlFor="reset-password" className="block text-sm font-medium text-foreground mb-2">
                    {t('auth.reset.newPassword')}
                  </label>
                  <InputGroup fullWidth>
                    <InputGroup.Prefix>
                      <Lock className="size-5 text-muted" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      id="reset-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.reset.newPassword')}
                      autoFocus
                      required
                    />
                  </InputGroup>
                  <p className="text-xs text-muted mt-2">{t('auth.reset.rule')}</p>
                </div>

                <div>
                  <label htmlFor="reset-confirm" className="block text-sm font-medium text-foreground mb-2">
                    {t('auth.reset.confirmPassword')}
                  </label>
                  <InputGroup fullWidth>
                    <InputGroup.Prefix>
                      <Lock className="size-5 text-muted" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      id="reset-confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder={t('auth.reset.confirmPassword')}
                      required
                    />
                  </InputGroup>
                </div>

                <Button type="submit" variant="primary" size="lg" fullWidth isDisabled={loading}>
                  {loading ? t('auth.reset.submitting') : t('auth.reset.submit')}
                </Button>
              </form>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}
