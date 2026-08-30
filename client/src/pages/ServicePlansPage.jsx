import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore, PERMISSIONS } from '../stores/userStore'
import { servicePlansApi } from '../lib/api'
import { X, Plus, Edit2, Trash2, CreditCard, Calendar, Repeat } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const BILLING_CYCLE_KEYS = {
  monthly: 'services.monthly',
  annual: 'services.annual',
  one_time: 'services.oneTime',
}

export default function ServicePlansPage() {
  const { t, language } = useAppStore()
  const { hasPermission } = useUserStore()
  const canEdit = hasPermission(PERMISSIONS.SERVICES_EDIT)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchPlans() }, [])

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const { data } = await servicePlansApi.getAll()
      setPlans(data)
    } catch (err) {
      console.error('Failed to fetch plans:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await servicePlansApi.delete(id)
      setDeleteTarget(null)
      fetchPlans()
    } catch (err) {
      console.error('Failed to delete plan:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('services.plansTitle') || 'Service Plans'}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('services.plansSubtitle') || 'Manage service packages and pricing'}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus className="w-4 h-4" />{t('services.addPlan') || 'Add Plan'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('common.loading') || 'Loading...'}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <CreditCard className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">{t('services.noPlans') || 'No plans yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => {
            const cycleKey = BILLING_CYCLE_KEYS[plan.billing_cycle] || BILLING_CYCLE_KEYS.monthly
            const cycleLabel = t(cycleKey)
            const features = Array.isArray(plan.features) ? plan.features : []
            return (
              <div key={plan.id} className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 shadow-sm rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Repeat className="w-3 h-3" />{cycleLabel}
                      </span>
                      {plan.duration_months > 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {plan.duration_months} {t('services.months') || 'months'}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(plan); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(plan.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                {plan.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{plan.description}</p>}
                {features.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {features.map((f, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-2xl font-bold text-primary-600">
                  {plan.price?.toLocaleString()} {t('common.currency') || 'EGP'}
                  <span className="text-sm font-normal text-gray-500">/{cycleLabel}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <PlanForm plan={editing} onSave={async (data) => {
          if (editing) await servicePlansApi.update(editing.id, data)
          else await servicePlansApi.create(data)
          setShowForm(false); setEditing(null); fetchPlans()
        }} onClose={() => { setShowForm(false); setEditing(null) }} />
      )}
      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => handleDelete(deleteTarget)}
        title={t('services.deletePlan') || 'Delete Plan'} message={t('services.deletePlanConfirm') || 'Are you sure?'} type="danger" loading={deleting} />
    </div>
  )
}

function PlanForm({ plan, onSave, onClose }) {
  const { t } = useAppStore()
  const [form, setForm] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price || '',
    billing_cycle: plan?.billing_cycle || 'monthly',
    duration_months: plan?.duration_months || 1,
    features: Array.isArray(plan?.features) ? plan.features.join('\n') : '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const features = form.features.split('\n').map(f => f.trim()).filter(Boolean)
    await onSave({ ...form, price: parseFloat(form.price) || 0, duration_months: parseInt(form.duration_months) || 1, features })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">{plan ? t('services.editPlan') : t('services.addPlan')}</h2>
          <button onClick={onClose} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.name') || 'Name'} *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.description') || 'Description'}</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('services.price') || 'Price'} *</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('services.billingCycle') || 'Billing Cycle'}</label>
              <select value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <option value="monthly">{t('services.monthly') || 'Monthly'}</option>
                <option value="annual">{t('services.annual') || 'Annual'}</option>
                <option value="one_time">{t('services.oneTime') || 'One Time'}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.durationMonths') || 'Duration (months)'}</label>
            <input type="number" min="1" value={form.duration_months} onChange={e => setForm({ ...form, duration_months: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.features') || 'Features (one per line)'}</label>
            <textarea value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} rows={4}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              placeholder={t('services.featuresPlaceholder')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{t('common.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
