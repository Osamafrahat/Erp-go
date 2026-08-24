import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { paymentsApi, suppliersApi } from '../lib/api'
import { DollarSign, Plus, Search, Trash2, Save, X, ArrowUpRight, ArrowDownRight, Pencil } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function PaymentsPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [payments, setPayments] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    payment_type: 'inbound',
    method: 'cash',
    amount: '',
    reference: '',
    notes: '',
    payment_date: new Date().toISOString().split('T')[0],
    partner_type: '',
    partner_id: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchPayments()
    suppliersApi.getAll().then(res => setSuppliers(res.data || [])).catch(() => {})
  }, [search, filterType])

  const fetchPayments = async () => {
    try {
      const { data } = await paymentsApi.getAll({ search, payment_type: filterType })
      setPayments(data.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleEdit = (payment) => {
    setEditingId(payment.id)
    setFormData({
      payment_type: payment.payment_type,
      method: payment.method,
      amount: payment.amount.toString(),
      reference: payment.reference || '',
      notes: payment.notes || '',
      payment_date: payment.payment_date,
      partner_type: payment.partner_type || '',
      partner_id: payment.partner_id || '',
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) return toastError(t('accounting.enterAmount'))
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editingId) {
        await paymentsApi.update(editingId, formData)
        toastSuccess(t('common.updated') || 'Updated successfully')
      } else {
        await paymentsApi.create(formData)
        toastSuccess(t('accounting.paymentRecorded'))
      }
      setShowForm(false)
      setEditingId(null)
      setFormData({ payment_type: 'inbound', method: 'cash', amount: '', reference: '', notes: '', payment_date: new Date().toISOString().split('T')[0], partner_type: '', partner_id: '' })
      fetchPayments()
    } catch (err) {
      toastError(err.response?.data?.error || 'Failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await paymentsApi.delete(id)
      toastSuccess(t('accounting.paymentDeleted'))
      fetchPayments()
      setDeleteTarget(null)
    } catch (err) {
      toastError(err.response?.data?.error || 'Failed')
    } finally {
      setDeleting(false)
    }
  }

  const totalInbound = payments.filter(p => p.payment_type === 'inbound').reduce((s, p) => s + p.amount, 0)
  const totalOutbound = payments.filter(p => p.payment_type === 'outbound').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('accounting.payments') || 'Payments'}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('accounting.paymentsDesc') || 'Track all payments in and out'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('accounting.newPayment') || 'New Payment'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><ArrowDownRight className="w-4 h-4 text-green-500" /> {t('accounting.inbound')}</div>
          <p className="text-xl font-bold text-green-600">{totalInbound.toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><ArrowUpRight className="w-4 h-4 text-red-500" /> {t('accounting.outbound')}</div>
          <p className="text-xl font-bold text-red-600">{totalOutbound.toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><DollarSign className="w-4 h-4 text-primary-500" /> {t('accounting.net')}</div>
          <p className={`text-xl font-bold ${(totalInbound - totalOutbound) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(totalInbound - totalOutbound).toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search') || 'Search...'} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">{t('accounting.allTypes')}</option>
          <option value="inbound">{t('accounting.inbound')}</option>
          <option value="outbound">{t('accounting.outbound')}</option>
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold">{editingId ? (t('accounting.editPayment') || 'Edit Payment') : (t('accounting.newPayment') || 'New Payment')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <select value={formData.payment_type} onChange={e => setFormData({ ...formData, payment_type: e.target.value, partner_type: '', partner_id: '' })} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="inbound">{t('accounting.inbound')} ({t('accounting.received')})</option>
                <option value="outbound">{t('accounting.outbound')} ({t('accounting.paid')})</option>
              </select>
              <select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="cash">{t('accounting.cash')}</option>
                <option value="bank_transfer">{t('accounting.bankTransfer')}</option>
                <option value="card">{t('accounting.card')}</option>
                <option value="check">{t('accounting.check')}</option>
              </select>
            </div>

            {/* Partner Selection */}
            {formData.payment_type === 'outbound' && (
              <select
                value={`${formData.partner_type}:${formData.partner_id}`}
                onChange={e => {
                  const [type, id] = e.target.value.split(':')
                  setFormData({ ...formData, partner_type: type, partner_id: id })
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value=":">{t('accounting.selectSupplier') || 'Select supplier...'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={`supplier:${s.id}`}>{s.name}</option>
                ))}
              </select>
            )}
            <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder={`${t('accounting.amount')} (EGP)`} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500 text-lg font-bold" />
            <input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            <input value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder={`${t('accounting.reference')} (${t('accounting.optional')})`} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder={`${t('common.description')} (${t('accounting.optional')})`} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            <div className="flex gap-3">
              <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {t('common.save') || 'Save'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ payment_type: 'inbound', method: 'cash', amount: '', reference: '', notes: '', payment_date: new Date().toISOString().split('T')[0], partner_type: '', partner_id: '' }) }} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium flex items-center gap-2">
                <X className="w-4 h-4" /> {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="text-start px-6 py-3 font-medium">{t('accounting.paymentNumber')}</th>
                <th className="text-start px-6 py-3 font-medium">{t('common.date')}</th>
                <th className="text-start px-6 py-3 font-medium">{t('accounting.type')}</th>
                <th className="text-start px-6 py-3 font-medium">{t('accounting.method')}</th>
                <th className="text-end px-6 py-3 font-medium">{t('accounting.amount')}</th>
                <th className="text-start px-6 py-3 font-medium">{t('accounting.reference')}</th>
                <th className="text-end px-6 py-3 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-6 py-3 text-sm font-mono font-bold">{payment.payment_number}</td>
                  <td className="px-6 py-3 text-sm">{payment.payment_date}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold ${payment.payment_type === 'inbound' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {payment.payment_type === 'inbound' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      {t('accounting.type' + payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1))}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">{t('accounting.method' + payment.method.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''))}</td>
                  <td className="px-6 py-3 text-sm text-end font-mono font-bold">{payment.amount.toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{payment.reference || '-'}</td>
                  <td className="px-6 py-3 text-end">
                    {!payment.journal_entry_id && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(payment)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget(payment.id)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {payments.length === 0 && <p className="text-center py-8 text-gray-400">{t('accounting.noPayments')}</p>}
        </div>
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('accounting.deletePayment') || 'Delete Payment'}
        message={t('accounting.deletePaymentConfirm') || 'Are you sure you want to delete this payment?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}
