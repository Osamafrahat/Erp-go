import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { useAppStore } from '../stores/appStore'
import { Store, User, Lock, AlertCircle, Info } from 'lucide-react'
import { Alert, Button, Card, Input, InputGroup } from '@heroui/react'

export default function LoginPage() {
  const { t, settings } = useAppStore()
  const { login } = useUserStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sessionExpired) {
      setError(t('password.sessionExpired') || 'Your session expired. Another login was detected. Please login again.')
    }
  }, [sessionExpired, t])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-background dark:to-background-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-2xl mb-4 overflow-hidden">
            {settings.storeLogo ? (
              <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-10 h-10 text-accent-foreground" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{settings.storeName || 'ERP-GO'}</h1>
          <p className="text-muted mt-2">{t('users.signInTitle')}</p>
        </div>

        {/* Login Form */}
        <Card>
          <Card.Content className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert status={sessionExpired ? 'accent' : 'danger'} className="text-start">
                  <Alert.Indicator>
                    {sessionExpired ? <Info className="size-5" /> : <AlertCircle className="size-5" />}
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <div>
                <label htmlFor="login-username" className="block text-sm font-medium text-foreground mb-2">
                  {t('users.username')}
                </label>
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <User className="size-5 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('users.enterUsername')}
                    autoFocus
                    required
                  />
                </InputGroup>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-foreground mb-2">
                  {t('users.password')}
                </label>
                <InputGroup fullWidth>
                  <InputGroup.Prefix>
                    <Lock className="size-5 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('users.enterPassword')}
                    required
                  />
                </InputGroup>
              </div>

              <Button type="submit" variant="primary" size="lg" fullWidth isDisabled={loading}>
                {loading ? t('users.signingIn') : t('users.signIn')}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-sm text-muted mb-3">{t('login.noStore') || "Don't have a store yet?"}</p>
              {/* react-router Link keeps client-side navigation (and middle-click),
                  so it borrows HeroUI's outline button classes rather than becoming
                  a <Button>, which would render a plain element instead. */}
              <Link
                to="/signup"
                className="button button--outline button--md button--full-width"
              >
                {t('login.createStore') || 'Create Store'}
              </Link>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}
