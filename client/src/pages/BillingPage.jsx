import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import api from '../lib/api'
import { CreditCard, Users, Package, ShoppingCart, Clock, ArrowUpRight, ExternalLink } from 'lucide-react'

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

  useEffect(() => {
    const fetchBilling = async () => {
      try {
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
    fetchBilling()
  }, [currentUser])

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
            {tier !== 'free' && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ${tier === 'pro' ? (t('billing.pricePro') || '$29') : (t('billing.priceEnterprise') || '$99')}/{t('billing.perMonth') || 'month'}
              </p>
            )}
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
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('billing.contactSupport') || 'Contact Support'}
            </button>
          )}
        </div>
      </div>

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
    </div>
  )
}
