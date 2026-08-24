import { useState, useEffect } from 'react'
import { useCartStore } from '../../stores/cartStore'
import { useAppStore } from '../../stores/appStore'
import { formatCurrency, calculateChange } from '../../lib/utils'
import { X, CreditCard, Banknote, Smartphone, Check } from 'lucide-react'

export default function PaymentModal({ onClose, onComplete, isSubmitting }) {
  const { items, getSubtotal, getDiscount, getTax, getTotal, promoCode, promoDiscount } = useCartStore()
  const { settings, t, toastError } = useAppStore()

  const paymentMethods = [
    { id: 'cash', name: t('payment.cash'), icon: Banknote, color: 'text-green-600' },
    { id: 'card', name: t('payment.card'), icon: CreditCard, color: 'text-blue-600' },
    { id: 'mobile', name: t('payment.mobile'), icon: Smartphone, color: 'text-purple-600' },
  ]

  const [selectedMethod, setSelectedMethod] = useState('cash')
  const [payments, setPayments] = useState([])
  const [cashTendered, setCashTendered] = useState('')
  const [mobileRef, setMobileRef] = useState('')
  const [cardRef, setCardRef] = useState('')

  const total = getTotal(settings.taxRate)
  const remaining = Math.round((total - payments.reduce((sum, p) => sum + p.amount, 0)) * 100) / 100

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.target.closest('.no-enter-shortcut')) {
        e.preventDefault()
        if (remaining <= 0.01 && payments.length > 0) {
          handleComplete()
        } else {
          handleAddPayment()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [remaining, payments.length])

  const handleAddPayment = () => {
    let amount = 0
    let reference = ''

    if (selectedMethod === 'cash') {
      amount = parseFloat(cashTendered) || 0
      if (amount <= 0) return
    } else {
      amount = remaining
      if (selectedMethod === 'mobile') {
        reference = mobileRef
      } else {
        reference = cardRef
      }
    }

    // Allow small floating point tolerance (0.01)
    if (amount > remaining + 0.01) {
      toastError(t('payment.exceedsBalance'))
      return
    }

    // Cap amount to remaining if slightly over due to floating point
    const finalAmount = Math.min(amount, remaining)

    setPayments([...payments, { method: selectedMethod, amount: finalAmount, reference }])
    setCashTendered('')
    setMobileRef('')
    setCardRef('')
  }

  const handleRemovePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index))
  }

  const handleComplete = () => {
    if (remaining > 0.01) {
      toastError(t('payment.notComplete'))
      return
    }
    onComplete({ method: payments[0]?.method || 'cash', payments })
  }

  const change = selectedMethod === 'cash' && cashTendered
    ? calculateChange(parseFloat(cashTendered), remaining)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">{t('payment.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Summary */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">{t('cart.subtotal')}</span>
            <span>{formatCurrency(getSubtotal())}</span>
          </div>
          {getDiscount() > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>{t('cart.discount')} ({promoCode})</span>
              <span>-{formatCurrency(getDiscount())}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">{t('cart.tax')} ({settings.taxRate}%)</span>
            <span>{formatCurrency(getTax(settings.taxRate))}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
            <span>{t('cart.total')}</span>
            <span className="text-primary-600">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                    ${selectedMethod === method.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className={`w-6 h-6 ${method.color}`} />
                  <span className="font-medium">{method.name}</span>
                </button>
              )
            })}
          </div>

          {/* Payment Input */}
          {selectedMethod === 'cash' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('payment.cashTendered')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={t('payment.enterAmount')}
                className="w-full px-4 py-3 text-lg rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                autoFocus
              />
              {change > 0 && (
                <p className="text-lg font-semibold text-green-600">
                  {t('payment.change')}: {formatCurrency(change)}
                </p>
              )}
            </div>
          )}

          {selectedMethod === 'mobile' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('payment.referenceNumber')}
              </label>
              <input
                type="text"
                value={mobileRef}
                onChange={(e) => setMobileRef(e.target.value)}
                placeholder={t('payment.referenceNumber')}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                autoFocus
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('payment.fullAmount')}: {formatCurrency(remaining)}
              </p>
            </div>
          )}

          {selectedMethod === 'card' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('payment.cardReference')}
              </label>
              <input
                type="text"
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
                placeholder={t('payment.cardReference')}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                autoFocus
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('payment.fullAmount')}: {formatCurrency(remaining)}
              </p>
            </div>
          )}

          {/* Add Payment Button */}
          <button
            onClick={handleAddPayment}
            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {selectedMethod === 'cash' ? t('payment.addPayment') : `Pay ${formatCurrency(remaining)} with ${paymentMethods.find(m => m.id === selectedMethod)?.name}`}
          </button>
        </div>

        {/* Payment Summary */}
        {payments.length > 0 && (
          <div className="px-4 pb-4 space-y-2">
            <h3 className="font-medium text-sm text-gray-500 dark:text-gray-400">{t('payment.paymentsAdded')}</h3>
            {payments.map((payment, index) => {
              const method = paymentMethods.find(m => m.id === payment.method)
              const Icon = method?.icon
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className={`w-5 h-5 ${method.color}`} />}
                    <span className="font-medium">{method?.name}</span>
                    {payment.reference && (
                      <span className="text-sm text-gray-500">({payment.reference})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                    <button
                      onClick={() => handleRemovePayment(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Remaining & Complete */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-lg mb-4">
            <span className="text-gray-500 dark:text-gray-400">{t('payment.remaining')}</span>
            <span className={`font-bold ${remaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {formatCurrency(remaining)}
            </span>
          </div>
          <button
            onClick={handleComplete}
            disabled={remaining > 0.01 || isSubmitting}
            className={`
              w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2
              ${remaining <= 0.01 && !isSubmitting
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {t('payment.completeSale')}
          </button>
        </div>
      </div>
    </div>
  )
}
