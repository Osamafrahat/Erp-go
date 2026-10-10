import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { paymobApi, billingApi } from '../lib/api'
import { Check, X, Star, Zap, Crown, CreditCard, Smartphone, Loader2, ArrowDown } from 'lucide-react'
import api from '../lib/api'

const TIER_ORDER = { free: 0, pro: 1, enterprise: 2 }

function fmt(v) { return v === -1 || v === Infinity || v === null ? '∞' : v?.toLocaleString() }

function getTiers(t, plans = [], billingPeriod = 'monthly') {
  const planMap = {}
  for (const p of plans) planMap[p.slug] = p

  const getPrice = (slug) => {
    const plan = planMap[slug]
    if (!plan) return null
    return billingPeriod === 'yearly' ? (plan.price_yearly ?? null) : plan.price_monthly
  }

  const prod = (slug) => { const v = planMap[slug]?.max_products; return v === -1 || v === Infinity ? (t('pricing.unlimited') || 'Unlimited') : fmt(v) }
  const users = (slug) => { const v = planMap[slug]?.max_users; return v === -1 || v === Infinity ? (t('pricing.unlimited') || 'Unlimited') : fmt(v) }
  const orders = (slug) => { const v = planMap[slug]?.max_orders_monthly; return v === -1 || v === Infinity ? (t('pricing.unlimited') || 'Unlimited') : fmt(v) }

  return [
    {
      id: 'free',
      name: t('pricing.free') || 'Free',
      price: 0,
      yearlyPrice: 0,
      period: billingPeriod === 'yearly' ? (t('pricing.perYear') || '/yr') : (t('pricing.perMonth') || '/mo'),
      icon: Star,
      color: 'gray',
      popular: false,
      features: [
        { text: `${prod('free')} ${t('pricing.products') || 'Products'}`, included: true },
        { text: `${users('free')} ${t('pricing.users') || 'Users'}`, included: true },
        { text: `${orders('free')} ${t('pricing.ordersPerMonth') || 'Orders/month'}`, included: true },
        { text: t('pricing.basicReports') || 'Basic Reports', included: true },
        { text: t('pricing.posSystem') || 'POS System', included: true },
        { text: t('pricing.prioritySupport') || 'Priority Support', included: false },
      ],
    },
    {
      id: 'pro',
      name: t('pricing.pro') || 'Pro',
      price: getPrice('pro') ?? 599,
      yearlyPrice: planMap.pro?.price_yearly ?? 5990,
      period: billingPeriod === 'yearly' ? (t('pricing.perYear') || '/yr') : (t('pricing.perMonth') || '/mo'),
      monthlyEquiv: billingPeriod === 'yearly' ? Math.round((planMap.pro?.price_yearly ?? 5990) / 12) : null,
      icon: Zap,
      color: 'primary',
      popular: true,
      features: [
        { text: `${prod('pro')} ${t('pricing.products') || 'Products'}`, included: true },
        { text: `${users('pro')} ${t('pricing.users') || 'Users'}`, included: true },
        { text: `${orders('pro')} ${t('pricing.ordersPerMonth') || 'Orders/month'}`, included: true },
        { text: t('pricing.advancedReports') || 'Advanced Reports', included: true },
        { text: t('pricing.posSystem') || 'POS System', included: true },
        { text: t('pricing.prioritySupport') || 'Priority Support', included: false },
      ],
    },
    {
      id: 'enterprise',
      name: t('pricing.enterprise') || 'Enterprise',
      price: getPrice('enterprise') ?? 1499,
      yearlyPrice: planMap.enterprise?.price_yearly ?? 14990,
      period: billingPeriod === 'yearly' ? (t('pricing.perYear') || '/yr') : (t('pricing.perMonth') || '/mo'),
      monthlyEquiv: billingPeriod === 'yearly' ? Math.round((planMap.enterprise?.price_yearly ?? 14990) / 12) : null,
      icon: Crown,
      color: 'yellow',
      popular: false,
      features: [
        { text: `${prod('enterprise')} ${t('pricing.products') || 'Products'}`, included: true },
        { text: `${users('enterprise')} ${t('pricing.users') || 'Users'}`, included: true },
        { text: `${orders('enterprise')} ${t('pricing.ordersPerMonth') || 'Orders/month'}`, included: true },
        { text: t('pricing.advancedReports') || 'Advanced Reports', included: true },
        { text: t('pricing.posSystem') || 'POS System', included: true },
        { text: t('pricing.prioritySupport') || 'Priority Support', included: true },
      ],
    },
  ]
}

const colorMap = {
  gray: {
bg:'bg-surface-secondary',
border:'border-border',
iconBg:'bg-surface-tertiary',
iconColor:'text-muted',
button:'bg-surface-secondary bg-surface-hover text-white',
buttonCurrent:'bg-surface-tertiary text-muted cursor-not-allowed',
buttonDowngrade:'bg-surface border border-border text-foreground hover:bg-red-50 hover:text-red-600',
check:'text-muted',
  },
  primary: {
bg:'bg-accent-soft',
border:'border-accent',
iconBg:'bg-accent-soft',
iconColor:'text-accent',
button:'bg-accent hover:bg-primary-700 text-white',
buttonCurrent:'bg-accent text-accent cursor-not-allowed',
buttonDowngrade:'bg-surface border border-accent text-accent hover:bg-red-50 hover:text-red-600',
check:'text-accent',
  },
  yellow: {
bg:'bg-warning-soft',
border:'border-warning',
iconBg:'bg-warning-soft',
iconColor:'text-warning',
button:'bg-warning hover:bg-yellow-700 text-white',
buttonCurrent:'bg-warning text-warning cursor-not-allowed',
buttonDowngrade:'bg-surface border border-warning text-warning hover:bg-red-50 hover:text-red-600',
check:'text-warning',
  },
}

export default function PricingPage() {
  const { t } = useAppStore()
  const { currentUser, refreshUser } = useUserStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showPayment, setShowPayment] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [plans, setPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState(currentUser?.subscription_tier || 'free')
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(null)
  const [downgrading, setDowngrading] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState('monthly')

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(data || [])).catch(() => {})
    api.get('/billing/current').then(({ data }) => {
      if (data?.tenant?.plan) setCurrentPlan(data.tenant.plan)
    }).catch(() => {})
  }, [])

  const tiers = getTiers(t, plans, billingPeriod)

  // Verify payment after Paymob redirect
  useEffect(() => {
    const intentionId = searchParams.get('intention_id') || searchParams.get('id')
    if (intentionId && !verifying && !verifyResult) {
      setVerifying(true)
      paymobApi.verify(intentionId)
        .then(async ({ data }) => {
          setVerifyResult(data)
          if (data.paid) {
            await refreshUser()
            navigate('/dashboard?upgraded=true')
          }
        })
        .catch(() => setVerifyResult({ paid: false }))
        .finally(() => setVerifying(false))
    }
  }, [searchParams])

  const handlePlanAction = (tier) => {
    const currentOrder = TIER_ORDER[currentPlan] ?? 0
    const targetOrder = TIER_ORDER[tier.id] ?? 0

    // Same plan → do nothing
    if (currentOrder === targetOrder) return

    // Not logged in → go to signup
    if (!currentUser) {
      navigate(`/signup?plan=${tier.id}`)
      return
    }

    // Upgrade → open payment modal
    if (targetOrder > currentOrder) {
      setShowPayment(tier)
      return
    }

    // Downgrade → show confirmation
    setShowDowngradeConfirm(tier)
  }

  const handleDowngrade = async () => {
    if (!showDowngradeConfirm) return
    setDowngrading(true)
    try {
      await billingApi.downgrade({ planSlug: showDowngradeConfirm.id })
      await refreshUser()
      setCurrentPlan(showDowngradeConfirm.id)
      setShowDowngradeConfirm(null)
      navigate('/billing')
    } catch (err) {
      alert(err.response?.data?.error || (t('pricing.downgradeFailed') || 'Downgrade failed'))
    } finally {
      setDowngrading(false)
    }
  }

  const handlePaymob = async () => {
    if (!showPayment) return
    setProcessing(true)
    try {
      const { data } = await paymobApi.checkout({
        amount: showPayment.price,
        planSlug: showPayment.id,
        billingPeriod,
      })
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err) {
      alert(err.response?.data?.error || (t('pricing.paymentFailed') || 'Payment failed'))
      setProcessing(false)
    }
  }

  const upgraded = searchParams.get('upgraded') === 'true'

  return (
<div className="min-h-screen bg-surface-secondary py-8 sm:py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {verifying && (
<div className="mb-6 p-4 bg-accent-soft border border-accent rounded-xl flex items-center gap-3">
<Loader2 className="w-5 h-5 animate-spin text-accent"/>
<span className="text-accent">{t('pricing.verifyingPayment')||'Verifying your payment...'}</span>
          </div>
        )}

        {upgraded && (
<div className="mb-6 p-4 bg-success-soft border border-success rounded-xl">
<p className="text-success font-medium">{t('pricing.upgradeSuccess')||'Your plan has been upgraded successfully!'}</p>
          </div>
        )}
        <div className="text-center mb-12">
<h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t('pricing.title') || 'Choose Your Plan'}
          </h1>
<p className="mt-3 text-base sm:text-lg text-muted">
            {t('pricing.subtitle') || 'Scale your business with the right tools'}
          </p>

<div className="mt-6 inline-flex items-center gap-3 bg-surface-tertiary rounded-xl p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingPeriod === 'monthly'
?'bg-surface text-foreground shadow-sm'
:'text-muted text-foreground'
              }`}
            >
              {t('pricing.monthly') || 'Monthly'}
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                billingPeriod === 'yearly'
?'bg-surface text-foreground shadow-sm'
:'text-muted text-foreground'
              }`}
            >
              {t('pricing.yearly') || 'Yearly'}
<span className="absolute -top-2 -right-4 text-[10px] font-bold text-success">
                {t('pricing.save') || 'Save 17%'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const colors = colorMap[tier.color]
            const Icon = tier.icon
            const isCurrent = currentPlan === tier.id
            const isUpgrade = TIER_ORDER[tier.id] > TIER_ORDER[currentPlan]
            const isDowngrade = TIER_ORDER[tier.id] < TIER_ORDER[currentPlan]

            let buttonLabel, buttonClass, buttonDisabled
            if (isCurrent) {
              buttonLabel = t('pricing.currentPlan') || 'Current Plan'
              buttonClass = colors.buttonCurrent
              buttonDisabled = true
            } else if (isDowngrade) {
              buttonLabel = t('pricing.downgrade') || 'Downgrade'
              buttonClass = colors.buttonDowngrade
              buttonDisabled = false
            } else {
              buttonLabel = currentUser ? (t('pricing.upgrade') || 'Upgrade') : (t('pricing.getStarted') || 'Get Started')
              buttonClass = colors.button
              buttonDisabled = false
            }

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-4 sm:p-6 flex flex-col ${
tier.popular ?'ring-2 ring-primary-500 shadow-xl md:scale-105':'shadow-md'
                }`}
              >
                {tier.popular && (
<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t('pricing.mostPopular') || 'Most Popular'}
                  </div>
                )}

                {isCurrent && (
<div className="absolute -top-3 right-4 bg-success text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t('pricing.current') || 'Current'}
                  </div>
                )}

                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colors.iconBg} mb-4`}>
                  <Icon className={`w-6 h-6 ${colors.iconColor}`} />
                </div>

<h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                <div className="mt-2 mb-6">
<span className="text-2xl sm:text-4xl font-bold text-foreground">{tier.price>0 ?`${tier.price.toLocaleString()}ج.م`:(t('pricing.free')||'Free')}</span>
<span className="text-muted">{tier.period}</span>
                  {tier.monthlyEquiv && billingPeriod === 'yearly' && (
<p className="text-xs text-success mt-1">
                      ({tier.monthlyEquiv.toLocaleString()} ج.م/{t('pricing.perMonth') || 'mo'})
                    </p>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className={`w-4 h-4 ${colors.check}`} />
                      ) : (
<X className="w-4 h-4 text-foreground"/>
                      )}
<span className={`text-xs sm:text-sm ${feature.included ?'text-foreground':'text-muted'}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanAction(tier)}
                  disabled={buttonDisabled}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${buttonClass}`}
                >
                  {isDowngrade && <ArrowDown className="w-4 h-4" />}
                  {buttonLabel}
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
<h2 className="text-xl font-bold text-foreground mb-4">
            {t('pricing.paymentMethodsTitle') || 'Accepted Payment Methods'}
          </h2>
<div className="flex flex-wrap justify-center gap-6 text-muted">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <span>{t('pricing.visaMastercard') || 'Visa / Mastercard'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <span>{t('pricing.vodafoneCash') || 'Vodafone Cash'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <span>{t('pricing.orangeMoney') || 'Orange Money'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <span>{t('pricing.etisalatCash') || 'Etisalat Cash'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏪</span>
              <span>{t('pricing.fawry') || 'Fawry'}</span>
            </div>
          </div>
<p className="mt-4 text-sm text-muted">
            {t('pricing.allPricesEGP') || 'All prices are in Egyptian Pounds (EGP)'}
          </p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowPayment(null); setProcessing(false) }}>
<div className="bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6 relative"onClick={(e)=>e.stopPropagation()}>
            <button
              onClick={() => { setShowPayment(null); setProcessing(false) }}
className="absolute top-4 right-4 text-muted text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

<h2 className="text-lg font-semibold text-foreground mb-1">
              {t('pricing.payFor') || 'Pay for'} {showPayment.name}
            </h2>
<p className="text-2xl font-bold text-foreground mb-1">
              {showPayment.price.toLocaleString()} ج.م{showPayment.period}
            </p>
            {billingPeriod === 'yearly' && showPayment.monthlyEquiv && (
<p className="text-xs text-muted mb-6">
                ({showPayment.monthlyEquiv.toLocaleString()} ج.م/{t('pricing.perMonth') || 'mo'})
              </p>
            )}
            {billingPeriod === 'monthly' && (
              <div className="mb-6" />
            )}

            <div className="space-y-3">
              <button
                onClick={handlePaymob}
                disabled={processing}
className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-accent hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                {t('pricing.payWithCard') || 'Pay with Card / Wallet / Fawry'}
              </button>
            </div>

<p className="text-xs text-muted text-center mt-4">
              {t('pricing.securePayment') || 'Secure payment processed by Paymob'}
            </p>
          </div>
        </div>
      )}

      {/* Downgrade Confirmation Modal */}
      {showDowngradeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDowngradeConfirm(null)}>
<div className="bg-surface rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 relative"onClick={(e)=>e.stopPropagation()}>
            <button
              onClick={() => setShowDowngradeConfirm(null)}
className="absolute top-4 right-4 text-muted text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
<div className="w-12 h-12 rounded-full bg-warning-soft flex items-center justify-center mx-auto mb-4">
<ArrowDown className="w-6 h-6 text-warning"/>
              </div>
<h2 className="text-lg font-semibold text-foreground mb-2">
                {t('pricing.downgradeTitle') || 'Downgrade Plan?'}
              </h2>
<p className="text-sm text-muted mb-2">
                {t('pricing.downgradeConfirm') || 'You will be moved to'} <strong>{showDowngradeConfirm.name}</strong>
              </p>
<p className="text-sm text-warning mb-6">
                {t('pricing.downgradeWarning') || 'Your product/user limits will be reduced. Existing data will not be deleted.'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeConfirm(null)}
className="flex-1 py-2.5 rounded-lg font-medium bg-surface-tertiary text-foreground bg-surface-hover transition-colors"
                >
                  {t('pricing.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleDowngrade}
                  disabled={downgrading}
className="flex-1 py-2.5 rounded-lg font-medium bg-danger hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {downgrading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('pricing.confirmDowngrade') || 'Downgrade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
