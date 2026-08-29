import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { useAppStore } from '../stores/appStore'
import api from '../lib/api'
import { Store, User, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const { t, settings } = useAppStore()
  const { login } = useUserStore()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [checks, setChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    digit: false,
  })

  const validatePassword = (pw) => {
    setChecks({
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      digit: /[0-9]/.test(pw),
    })
  }

  const handlePasswordChange = (e) => {
    const pw = e.target.value
    setPassword(pw)
    validatePassword(pw)
  }

  const isPasswordValid = Object.values(checks).every(Boolean)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isPasswordValid) {
      setError(t('signup.errorRequirements') || 'Password does not meet requirements')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/signup', {
        storeName,
        fullName,
        username,
        password,
        email: email || undefined,
      })

      const result = await login(username, password)
      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(t('signup.errorLoginFailed') || 'Account created but login failed. Please sign in.')
        navigate('/login')
      }
    } catch (err) {
      setError(err.response?.data?.error || (t('signup.errorSignupFailed') || 'Signup failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-2xl mb-4 overflow-hidden">
            {settings.storeLogo ? (
              <img src={settings.storeLogo} alt={settings.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('signup.title') || 'Create Your Store'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('signup.subtitle') || 'Set up your store in minutes'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('signup.storeName') || 'Store Name'} *
              </label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder={t('signup.storeNamePlaceholder') || 'My Shop'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('signup.fullName') || 'Your Full Name'} *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder={t('signup.fullNamePlaceholder') || 'John Doe'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('signup.username') || 'Username'} *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder={t('signup.usernamePlaceholder') || 'johndoe'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('signup.password') || 'Password'} *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="••••••••"
                />
              </div>
              {password && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[
                    { key: 'length', label: t('signup.reqLength') || '8+ characters' },
                    { key: 'upper', label: t('signup.reqUpper') || 'Uppercase' },
                    { key: 'lower', label: t('signup.reqLower') || 'Lowercase' },
                    { key: 'digit', label: t('signup.reqDigit') || 'Digit' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1 text-xs">
                      <CheckCircle className={`w-3 h-3 ${checks[key] ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                      <span className={checks[key] ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('signup.email') || 'Email'} ({t('signup.optional') || 'optional'})
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder={t('signup.emailPlaceholder') || 'john@example.com'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? (t('signup.creating') || 'Creating Store...') : (t('signup.submit') || 'Create Store')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              {t('signup.alreadyHaveStore') || 'Already have a store? Sign in'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
