import { Alert, Button, Card, InputGroup } from '@heroui/react'
import { Store, Mail, AlertCircle, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import api from '../lib/api'

export default function ForgotPasswordPage() {
  const { t, settings } = useAppStore()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // The server answers identically for known and unknown emails (no account
  // enumeration), so one success state covers both.
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      if (err.response?.status === 429) {
        setError(t('auth.forgot.tooMany'))
      } else {
        setError(t('auth.forgot.failed'))
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{settings.storeName || 'Dukkanza'}</h1>
          <p className="text-muted mt-2">{t('auth.forgot.subtitle')}</p>
        </div>

        <Card>
          <Card.Content className="p-6 sm:p-8">
            {sent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto text-success" />
                <h2 className="text-lg font-semibold text-foreground">{t('auth.forgot.sentTitle')}</h2>
                <p className="text-sm text-muted">{t('auth.forgot.sentBody')}</p>
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
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground mb-2">
                    {t('auth.forgot.emailLabel')}
                  </label>
                  <InputGroup fullWidth>
                    <InputGroup.Prefix>
                      <Mail className="size-5 text-muted" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.forgot.emailPlaceholder')}
                      autoFocus
                      required
                    />
                  </InputGroup>
                </div>

                <Button type="submit" variant="primary" size="lg" fullWidth isDisabled={loading}>
                  {loading ? t('auth.forgot.sending') : t('auth.forgot.submit')}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-border text-center">
              <Link to="/login" className="text-sm text-accent hover:underline">
                {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}
