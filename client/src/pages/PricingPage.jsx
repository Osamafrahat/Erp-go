import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { Check, X, Star, Zap, Crown } from 'lucide-react'

function getTiers(t) {
  return [
    {
      id: 'free',
      name: t('pricing.free') || 'Free',
      price: 0,
      period: t('pricing.perMonth') || '/mo',
      icon: Star,
      color: 'gray',
      popular: false,
      features: [
        { text: t('pricing.freeProducts') || '50 Products', included: true },
        { text: t('pricing.freeUsers') || '2 Users', included: true },
        { text: t('pricing.freeOrders') || '100 Orders/month', included: true },
        { text: t('pricing.basicReports') || 'Basic Reports', included: true },
        { text: t('pricing.posSystem') || 'POS System', included: true },
        { text: t('pricing.inventoryTracking') || 'Inventory Tracking', included: false },
        { text: t('pricing.promotions') || 'Promotions', included: false },
        { text: t('pricing.prioritySupport') || 'Priority Support', included: false },
      ],
    },
    {
      id: 'pro',
      name: t('pricing.pro') || 'Pro',
      price: 599,
      period: t('pricing.perMonth') || '/mo',
      icon: Zap,
      color: 'primary',
      popular: true,
      features: [
        { text: t('pricing.proProducts') || '500 Products', included: true },
        { text: t('pricing.proUsers') || '15 Users', included: true },
        { text: t('pricing.unlimitedOrders') || 'Unlimited Orders', included: true },
        { text: t('pricing.advancedReports') || 'Advanced Reports', included: true },
        { text: t('pricing.posSystem') || 'POS System', included: true },
        { text: t('pricing.inventoryTracking') || 'Inventory Tracking', included: true },
        { text: t('pricing.promotions') || 'Promotions', included: true },
        { text: t('pricing.prioritySupport') || 'Priority Support', included: false },
      ],
    },
    {
      id: 'enterprise',
      name: t('pricing.enterprise') || 'Enterprise',
      price: 1499,
      period: t('pricing.perMonth') || '/mo',
      icon: Crown,
      color: 'yellow',
      popular: false,
      features: [
        { text: t('pricing.unlimitedProducts') || 'Unlimited Products', included: true },
        { text: t('pricing.unlimitedUsers') || 'Unlimited Users', included: true },
        { text: t('pricing.unlimitedOrders') || 'Unlimited Orders', included: true },
        { text: t('pricing.advancedReports') || 'Advanced Reports', included: true },
        { text: t('pricing.posSystem') || 'POS System', included: true },
        { text: t('pricing.inventoryTracking') || 'Inventory Tracking', included: true },
        { text: t('pricing.promotions') || 'Promotions', included: true },
        { text: t('pricing.prioritySupport') || 'Priority Support', included: true },
      ],
    },
  ]
}

const colorMap = {
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    iconBg: 'bg-gray-100 dark:bg-gray-700',
    iconColor: 'text-gray-600 dark:text-gray-300',
    button: 'bg-gray-600 hover:bg-gray-700 text-white',
    check: 'text-gray-500',
  },
  primary: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-500',
    iconBg: 'bg-primary-100 dark:bg-primary-800',
    iconColor: 'text-primary-600 dark:text-primary-400',
    button: 'bg-primary-600 hover:bg-primary-700 text-white',
    check: 'text-primary-500',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-400 dark:border-yellow-600',
    iconBg: 'bg-yellow-100 dark:bg-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    check: 'text-yellow-500',
  },
}

export default function PricingPage() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const navigate = useNavigate()

  const tiers = getTiers(t)
  const currentPlan = currentUser?.subscription_tier || 'free'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('pricing.title') || 'Choose Your Plan'}
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
            {t('pricing.subtitle') || 'Scale your business with the right tools'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const colors = colorMap[tier.color]
            const Icon = tier.icon
            const isCurrent = currentPlan === tier.id

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 flex flex-col ${
                  tier.popular ? 'ring-2 ring-primary-500 shadow-xl scale-105' : 'shadow-md'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t('pricing.mostPopular') || 'Most Popular'}
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t('pricing.current') || 'Current'}
                  </div>
                )}

                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colors.iconBg} mb-4`}>
                  <Icon className={`w-6 h-6 ${colors.iconColor}`} />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                <div className="mt-2 mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">${tier.price}</span>
                  <span className="text-gray-500 dark:text-gray-400">{tier.period}</span>
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className={`w-4 h-4 ${colors.check}`} />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                      <span className={`text-sm ${feature.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate(`/signup?plan=${tier.id}`)}
                  className={`w-full py-2.5 rounded-lg font-medium transition-colors ${colors.button}`}
                >
                  {isCurrent
                    ? (t('pricing.currentPlan') || 'Current Plan')
                    : (t('pricing.getStarted') || 'Get Started')}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
