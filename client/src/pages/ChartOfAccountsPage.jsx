import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import api, { accountsApi } from '../lib/api'
import { Plus, Search, Edit2, Trash2, Save, X, RefreshCw, Landmark } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function ChartOfAccountsPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ code: '', name: '', account_type: 'asset', description: '' })
  const [showCapitalModal, setShowCapitalModal] = useState(false)
  const [capitalAmount, setCapitalAmount] = useState('')
  const [capitalDesc, setCapitalDesc] = useState('')
  const [capitalLoading, setCapitalLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const getAccountName = (account) => {
    const key = `accounting.account.${account.code}`
    const translated = t(key)
    return translated !== key ? translated : account.name
  }

  const ACCOUNT_TYPES = {
    asset: { label: t('accounting.asset') || 'Asset', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    liability: { label: t('accounting.liability') || 'Liability', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    equity: { label: t('accounting.equity') || 'Equity', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    revenue: { label: t('accounting.revenue') || 'Revenue', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    expense: { label: t('accounting.expenseType') || 'Expense', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  }

  useEffect(() => { fetchAccounts() }, [])

  const fetchAccounts = async () => {
    try {
      const { data } = await accountsApi.getAll({ search, type: filterType })
      setAccounts(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSeed = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await accountsApi.seed()
      toastSuccess(t('accounting.seedSuccess'))
      fetchAccounts()
    } catch (err) { toastError(t('accounting.seedFailed')) }
    finally { setIsSubmitting(false) }
  }

  const handleRecalculate = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      setLoading(true)
      await api.post('/accounting/accounts/recalculate-balances')
      toastSuccess(t('accounting.balancesRecalculated') || 'Balances recalculated')
      fetchAccounts()
    } catch (err) {
      console.error(err)
      toastError(t('common.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetCapital = async () => {
    if (!capitalAmount || parseFloat(capitalAmount) <= 0) return
    try {
      setCapitalLoading(true)
      await accountsApi.setInitialCapital({ amount: parseFloat(capitalAmount), description: capitalDesc })
      toastSuccess(t('accounting.capitalRecorded') || 'Initial capital recorded')
      setShowCapitalModal(false)
      setCapitalAmount('')
      setCapitalDesc('')
      fetchAccounts()
    } catch (err) {
      toastError(err.response?.data?.error || t('common.error'))
    } finally {
      setCapitalLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editingId) {
        await accountsApi.update(editingId, formData)
        toastSuccess(t('accounting.accountUpdated'))
      } else {
        await accountsApi.create(formData)
        toastSuccess(t('accounting.accountCreated'))
      }
      setShowForm(false)
      setEditingId(null)
      setFormData({ code: '', name: '', account_type: 'asset', description: '' })
      fetchAccounts()
    } catch (err) { toastError(err.response?.data?.error || t('common.error')) }
    finally { setIsSubmitting(false) }
  }

  const handleEdit = (account) => {
    setFormData({ code: account.code, name: account.name, account_type: account.account_type, description: account.description || '' })
    setEditingId(account.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await accountsApi.delete(id)
      toastSuccess(t('accounting.accountDeleted'))
      fetchAccounts()
      setDeleteTarget(null)
    } catch (err) { toastError(err.response?.data?.error || t('common.error')) }
    finally { setDeleting(false) }
  }

  const filteredAccounts = accounts.filter(a => {
    if (filterType && a.account_type !== filterType) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.code.includes(search)) return false
    return true
  })

  const grouped = {}
  for (const type of ['asset', 'liability', 'equity', 'revenue', 'expense']) {
    grouped[type] = filteredAccounts.filter(a => a.account_type === type)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('accounting.chartOfAccounts')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('accounting.manageAccounts')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSeed} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">{t('accounting.seedDefaults')}</span>
          </button>
          <button onClick={handleRecalculate} className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/50 text-yellow-700 dark:text-yellow-400 rounded-xl font-medium flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">{t('accounting.recalculateBalances')}</span>
          </button>
          <button onClick={() => setShowCapitalModal(true)} className="px-4 py-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 rounded-xl font-medium flex items-center gap-2 text-sm">
            <Landmark className="w-4 h-4" /> <span className="hidden sm:inline">{t('accounting.setCapital')}</span>
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ code: '', name: '', account_type: 'asset', description: '' }) }} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('accounting.addAccount')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">{t('accounting.allTypes')}</option>
          {Object.entries(ACCOUNT_TYPES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">{editingId ? t('accounting.editAccount') : t('accounting.addAccount')}</h3>
            <input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder={t('accounting.code')} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('accounting.name')} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={formData.account_type} onChange={e => setFormData({ ...formData, account_type: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500">
              {Object.entries(ACCOUNT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder={t('common.description')} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3">
              <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {t('common.save')}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium flex items-center gap-2">
                <X className="w-4 h-4" /> {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCapitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">{t('accounting.setCapital')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('accounting.capitalDescription')}</p>
            <input
              type="number"
              value={capitalAmount}
              onChange={e => setCapitalAmount(e.target.value)}
              placeholder={t('accounting.capitalAmount')}
              min="0"
              step="0.01"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={capitalDesc}
              onChange={e => setCapitalDesc(e.target.value)}
              placeholder={t('accounting.capitalOptionalDesc')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSetCapital}
                disabled={!capitalAmount || parseFloat(capitalAmount) <= 0 || capitalLoading}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Landmark className="w-4 h-4" /> {capitalLoading ? t('common.saving') || 'Saving...' : t('common.save')}
              </button>
              <button onClick={() => { setShowCapitalModal(false); setCapitalAmount(''); setCapitalDesc('') }} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium flex items-center gap-2">
                <X className="w-4 h-4" /> {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => (
            items.length > 0 && (
              <div key={type} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold capitalize flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${ACCOUNT_TYPES[type].color}`}>{ACCOUNT_TYPES[type].label}</span>
                    {items.length} {t('accounting.accountsCount')}
                  </h3>
                  <span className="text-sm font-medium text-gray-500">{items.reduce((s, a) => s + a.balance, 0).toFixed(2)} EGP</span>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[450px]">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
                      <th className="text-start px-6 py-2 font-medium">{t('accounting.code')}</th>
                      <th className="text-start px-6 py-2 font-medium">{t('accounting.name')}</th>
                      <th className="text-end px-6 py-2 font-medium">{t('accounting.balance')}</th>
                      <th className="text-end px-6 py-2 font-medium">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(account => (
                      <tr key={account.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-6 py-3 text-sm font-mono font-bold">{account.code}</td>
                        <td className="px-6 py-3 text-sm font-medium">{getAccountName(account)}</td>
                        <td className="px-6 py-3 text-sm font-medium text-end">{account.balance.toFixed(2)} EGP</td>
                        <td className="px-6 py-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(account)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-600"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteTarget(account.id)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )
          ))}
        </div>
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('accounting.deleteAccount') || 'Delete Account'}
        message={t('accounting.deleteConfirm') || 'Are you sure you want to delete this account?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}
