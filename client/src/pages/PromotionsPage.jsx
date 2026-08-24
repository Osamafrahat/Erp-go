import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { promotionsApi } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import { X, Plus, Edit2, Trash2, Tag, Percent, DollarSign, CheckCircle, XCircle, Send } from 'lucide-react'
import SendPromotionModal from '../components/notifications/SendPromotionModal'
import ConfirmModal from '../components/ConfirmModal'

export default function PromotionsPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [sendPromo, setSendPromo] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchPromotions()
  }, [])

  const fetchPromotions = async () => {
    setLoading(true)
    try {
      const response = await promotionsApi.getAll()
      setPromotions(response.data)
    } catch (err) {
      console.error('Failed to fetch promotions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (promo) => {
    setEditingPromo(promo)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await promotionsApi.delete(id)
      toastSuccess(t('promotions.deleted') || 'Promotion deleted successfully')
      fetchPromotions()
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete promotion:', err)
      toastError(t('promotions.failedToDelete'))
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (promo) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await promotionsApi.update(promo.id, { is_active: !promo.is_active })
      toastSuccess(t('promotions.updated') || 'Promotion updated')
      fetchPromotions()
    } catch (err) {
      console.error('Failed to update promotion:', err)
      toastError(t('promotions.failedToUpdate') || 'Failed to update promotion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSave = async (promoData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      let savedPromo
      if (editingPromo) {
        const res = await promotionsApi.update(editingPromo.id, promoData)
        savedPromo = res.data
        toastSuccess(t('promotions.updated') || 'Promotion updated successfully')
      } else {
        const res = await promotionsApi.create(promoData)
        savedPromo = res.data
        toastSuccess(t('promotions.created') || 'Promotion created successfully')
      }
      setShowForm(false)
      setEditingPromo(null)
      fetchPromotions()

      // Auto-open send modal for new promotions
      if (!editingPromo && savedPromo?.id) {
        setTimeout(() => setSendPromo(savedPromo), 300)
      }
    } catch (err) {
      console.error('Failed to save promotion:', err)
      toastError(t('promotions.failedToSave'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isExpired = (endDate) => {
    return new Date(endDate) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('promotions.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('promotions.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setEditingPromo(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          {t('promotions.addPromo')}
        </button>
      </div>

      {/* Promotions List */}
      {promotions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Tag className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('promotions.noPromotions')}</h3>
          <p className="text-gray-500 dark:text-gray-400">{t('promotions.createFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((promo) => {
            const expired = isExpired(promo.end_date)
            const usageLimitReached = promo.max_uses && promo.used_count >= promo.max_uses

            return (
              <div
                key={promo.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${
                  !promo.is_active || expired
                    ? 'border-gray-200 dark:border-gray-700 opacity-60'
                    : 'border-primary-200 dark:border-primary-800'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      promo.type === 'percentage'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-green-100 dark:bg-green-900/30'
                    }`}>
                      {promo.type === 'percentage' ? (
                        <Percent className="w-5 h-5 text-blue-600" />
                      ) : (
                        <DollarSign className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-lg">{promo.code}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {promo.type === 'percentage' ? `${promo.value}% ${t('promotions.off')}` : `${formatCurrency(promo.value)} ${t('promotions.off')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(promo)}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(promo.id)}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('promotions.minOrder')}</span>
                    <span>{promo.min_order_amount ? formatCurrency(promo.min_order_amount) : t('common.none')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('promotions.usage')}</span>
                    <span>{promo.used_count} / {promo.max_uses || '∞'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('promotions.validTo')}</span>
                    <span>{formatDate(promo.end_date)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expired ? (
                      <span className="flex items-center gap-1 text-sm text-red-500">
                        <XCircle className="w-4 h-4" />
                        {t('promotions.expired')}
                      </span>
                    ) : usageLimitReached ? (
                      <span className="flex items-center gap-1 text-sm text-amber-500">
                        <XCircle className="w-4 h-4" />
                        {t('promotions.limitReached')}
                      </span>
                    ) : promo.is_active ? (
                      <span className="flex items-center gap-1 text-sm text-green-500">
                        <CheckCircle className="w-4 h-4" />
                        {t('promotions.active')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <XCircle className="w-4 h-4" />
                        {t('promotions.inactive')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSendPromo(promo)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                      title={t('promotions.sendNotification')}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(promo)}
                      disabled={expired}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        promo.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                      } ${expired ? 'cursor-not-allowed' : 'hover:opacity-80'}`}
                    >
                      {promo.is_active ? t('promotions.active') : t('promotions.inactive')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Promotion Form Modal */}
      {showForm && (
        <PromotionForm
          promotion={editingPromo}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false)
            setEditingPromo(null)
          }}
        />
      )}

      {/* Send Promotion Modal */}
      {sendPromo && (
        <SendPromotionModal
          promotion={sendPromo}
          onClose={() => setSendPromo(null)}
          onSent={fetchPromotions}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('promotions.deletePromotion') || 'Delete Promotion'}
        message={t('promotions.deleteConfirm') || 'Are you sure you want to delete this promotion?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}

function PromotionForm({ promotion, onSave, onClose }) {
  const { t } = useAppStore()
  const [formData, setFormData] = useState({
    code: promotion?.code || '',
    type: promotion?.type || 'percentage',
    value: promotion?.value || '',
    min_order_amount: promotion?.min_order_amount || '',
    max_uses: promotion?.max_uses || '',
    start_date: promotion?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    end_date: promotion?.end_date?.split('T')[0] || '',
    is_active: promotion?.is_active ?? true,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...formData,
      value: parseFloat(formData.value),
      min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {promotion ? t('promotions.editPromo') : t('promotions.addNewPromo')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('promotions.promoCodeLabel')} *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono uppercase"
              placeholder={t('promotions.promoCodePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('promotions.discountType')}
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="percentage">{t('promotions.percentage')} (%)</option>
                <option value="fixed">{t('promotions.fixed')} (ج.م)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {formData.type === 'percentage' ? t('promotions.percentageOff') : t('promotions.amountOff')} *
              </label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('promotions.minOrderAmount')}
              </label>
              <input
                type="number"
                name="min_order_amount"
                value={formData.min_order_amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                placeholder={t('promotions.noMinimum')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('promotions.maxUses')}
              </label>
              <input
                type="number"
                name="max_uses"
                value={formData.max_uses}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                placeholder={t('promotions.unlimited')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('promotions.startDate')}
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('promotions.endDate')} *
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('promotions.promotionActive')}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {promotion ? t('promotions.update') : t('promotions.create')} {t('promotions.title').split(' ')[0]}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
