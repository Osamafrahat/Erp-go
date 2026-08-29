import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import api from '../lib/api'
import { CreditCard, Users, Package, ShoppingCart, Clock, ArrowUpRight, ExternalLink, X, Mail, MessageCircle, Send, Loader2, CheckCircle, AlertTriangle, Trash2, Shield } from 'lucide-react'

function getTierLabels(t) {
  return { free: t('billing.free') || 'Free', pro: t('billing.pro') || 'Pro', enterprise: t('billing.enterprise') || 'Enterprise' }
}
const tierColors = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pro: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  enterprise: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}
function getStatusLabels(t) {
  return {
    active: t('billing.active') || 'Active',
    trialing: t('billing.trial') || 'Trial',
    cancelled: t('billing.cancelled') || 'Cancelled',
    past_due: t('billing.pastDue') || 'Past Due',
  }
}
const statusColors = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  past_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

const SUPPORT_EMAIL = 'support.erp.go@gmail.com'
const SUPPORT_WHATSAPP = '201555256213'

function ContactSupportModal({ open, onClose, t, currentUser }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!open) return null

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    try {
      const body = `Support Request\nFrom: ${currentUser?.fullName || currentUser?.username || 'User'}\nSubject: ${subject}\n\n${message}`
      window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[ERP-Go] ${subject}`)}&body=${encodeURIComponent(body)}`, '_blank')
      setSent(true)
      setTimeout(() => { setSent(false); onClose() }, 2000)
    } catch {
      window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[ERP-Go] ${subject}`)}&body=${encodeURIComponent(message)}`, '_blank')
      setSent(true)
      setTimeout(() => { setSent(false); onClose() }, 2000)
    } finally {
      setSending(false)
    }
  }

  const openWhatsApp = () => {
    const text = `Hi, I need support with ERP-Go.\nUser: ${currentUser?.fullName || currentUser?.username || 'N/A'}\n`
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {t('billing.contactSupport') || 'Contact Support'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('billing.supportDesc') || 'How can we help you?'}
        </p>

        {sent ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-green-700 dark:text-green-300 font-medium">{t('billing.messageSent') || 'Message ready!'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('billing.checkEmail') || 'Check your email client to send.'}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              <button
                onClick={openWhatsApp}
                className="w-full flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('billing.whatsapp') || 'WhatsApp'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('billing.whatsappDesc') || 'Chat with us instantly'}</p>
                </div>
              </button>

              <button
                onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[ERP-Go] Support Request')}`, '_blank')}
                className="w-full flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('billing.email') || 'Email'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{SUPPORT_EMAIL}</p>
                </div>
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('billing.orSendDirectly') || 'Or send a message directly:'}</p>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={t('billing.subject') || 'Subject'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2"
              />
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t('billing.message') || 'Describe your issue...'}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim() || sending}
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('billing.sendMessage') || 'Send Message'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function UsageBar({ label, used, max, icon: Icon }) {
  const pct = max === -1 ? 0 : Math.min((used / max) * 100, 100)
  const isUnlimited = max === -1

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {used} / {isUnlimited ? '∞' : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-primary-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="h-2 rounded-full bg-green-500" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSupport, setShowSupport] = useState(false)
  const [savedCards, setSavedCards] = useState([])
  const [deletingCard, setDeletingCard] = useState(null)
  const [plans, setPlans] = useState([])

  if (currentUser?.role !== 'MANAGER' && currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Shield className="w-12 h-12 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('common.accessDenied') || 'Access Denied'}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('billing.managerOnly') || 'Only managers can access billing.'}</p>
      </div>
    )
  }

  const fetchBilling = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/billing/current')
      setBilling(data)
    } catch {
      setBilling({
        tier: currentUser?.subscription_tier || 'free',
        status: 'active',
        trialEndsAt: null,
        productsUsed: 0,
        productsMax: 50,
        usersUsed: 1,
        usersMax: 2,
        ordersThisMonth: 0,
        ordersMax: 100,
        paymentHistory: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBilling() }, [currentUser])

  useEffect(() => {
    const onFocus = () => fetchBilling()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [currentUser])

  useEffect(() => {
    api.get('/billing/paymob/cards').then(({ data }) => setSavedCards(data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(data || [])).catch(() => {})
  }, [])

  const handleDeleteCard = async (cardId) => {
    setDeletingCard(cardId)
    try {
      await api.delete(`/billing/paymob/cards/${cardId}`)
      setSavedCards(prev => prev.filter(c => c.id !== cardId))
    } catch {
      alert('Failed to delete card')
    } finally {
      setDeletingCard(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const tier = billing?.tenant?.plan || billing?.tier || 'free'
  const status = billing?.tenant?.subscription_status || billing?.status || 'active'
  const tierLabels = getTierLabels(t)
  const statusLabels = getStatusLabels(t)
  const trialEnds = billing?.trialEndsAt ? new Date(billing.trialEndsAt) : null
  const trialDaysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds - Date.now()) / (1000 * 60 * 60 * 24))) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('billing.title') || 'Billing & Subscription'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('billing.subtitle') || 'Manage your subscription and usage'}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tierLabels[tier]} {t('billing.plan') || 'Plan'}
              </h2>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${tierColors[tier]}`}>
                {tierLabels[tier]}
              </span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[status]}`}>
                {statusLabels[status] || status}
              </span>
            </div>
            {tier !== 'free' && (() => {
              const plan = plans.find(p => p.slug === tier)
              const price = plan?.price_monthly || 0
              return (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {price.toLocaleString()} ج.م/{t('pricing.perMonth') || 'mo'}
                </p>
              )
            })()}
          </div>
          <Link
            to="/pricing"
            className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t('billing.viewPlans') || 'View Plans'} <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {status === 'trialing' && trialDaysLeft > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {t('billing.trialEndsIn') || 'Trial ends in'} {trialDaysLeft} {t('billing.days') || 'days'}
            </span>
          </div>
        )}

        {billing?.tenant?.renewal_note && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-orange-700 dark:text-orange-300">{billing.tenant.renewal_note}</span>
          </div>
        )}

        {billing?.tenant?.subscription_expires_at && tier !== 'free' && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg mb-4">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('billing.expiresOn') || 'Expires'} {new Date(billing.tenant.subscription_expires_at).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UsageBar
            label={t('billing.products') || 'Products'}
            used={billing?.usage?.products || billing?.productsUsed || 0}
            max={billing?.tenant?.max_products ?? billing?.productsMax ?? 50}
            icon={Package}
          />
          <UsageBar
            label={t('billing.users') || 'Users'}
            used={billing?.usage?.users || billing?.usersUsed || 0}
            max={billing?.tenant?.max_users ?? billing?.usersMax ?? 2}
            icon={Users}
          />
          <UsageBar
            label={t('billing.ordersThisMonth') || 'Orders This Month'}
            used={billing?.usage?.orders_this_month || billing?.ordersThisMonth || 0}
            max={billing?.tenant?.max_orders_monthly ?? billing?.ordersMax ?? -1}
            icon={ShoppingCart}
          />
        </div>

        <div className="flex gap-3 mt-6">
          {tier === 'free' ? (
            <Link
              to="/pricing"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              {t('billing.upgrade') || 'Upgrade Plan'}
            </Link>
          ) : (
            <button
              onClick={() => setShowSupport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('billing.contactSupport') || 'Contact Support'}
            </button>
          )}
        </div>
      </div>

      {tier !== 'free' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('billing.savedCards') || 'Saved Payment Methods'}
            </h3>
            <Link to="/pricing" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              {t('billing.addCard') || '+ Add Card'}
            </Link>
          </div>
          {savedCards.length > 0 ? (
            <div className="space-y-3">
              {savedCards.map(card => (
                <div key={card.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {card.card_brand || 'Card'} •••• {card.card_last_four || '****'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {card.is_default ? (t('billing.default') || 'Default') : ''} {card.created_at ? new Date(card.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    disabled={deletingCard === card.id}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingCard === card.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('billing.noSavedCards') || 'No saved payment methods'}</p>
              <p className="text-xs mt-1">{t('billing.addCardHint') || 'Save a card after your next payment for easy renewal'}</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('billing.paymentHistory') || 'Payment History'}
        </h3>
        {billing?.paymentHistory?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">{t('billing.date') || 'Date'}</th>
                  <th className="pb-2 font-medium">{t('billing.amount') || 'Amount'}</th>
                  <th className="pb-2 font-medium">{t('billing.status') || 'Status'}</th>
                  <th className="pb-2 font-medium">{t('billing.invoice') || 'Invoice'}</th>
                </tr>
              </thead>
              <tbody>
                {billing.paymentHistory.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2.5 text-gray-900 dark:text-white">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="py-2.5 text-gray-900 dark:text-white">${p.amount}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-primary-600 dark:text-primary-400">
                      <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="hover:underline">{t('billing.view') || 'View'}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('billing.noPayments') || 'No payment history yet'}</p>
          </div>
        )}
      </div>
      <ContactSupportModal open={showSupport} onClose={() => setShowSupport(false)} t={t} currentUser={currentUser} />
    </div>
  )
}
