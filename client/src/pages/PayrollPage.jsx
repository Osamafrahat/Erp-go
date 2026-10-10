import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { payrollApi } from '../lib/api'
import { DollarSign, Calendar, CheckCircle, Clock, FileText, Eye, Trash2, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const STATUS_COLORS = {
draft:'bg-surface-tertiary text-foreground',
processed:'bg-accent-soft text-accent-soft-foreground',
paid:'bg-success-soft text-success-soft-foreground',
}

export default function PayrollPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [payingItem, setPayingItem] = useState(null)
  const [paying, setPaying] = useState(false)

  useEffect(() => { fetchPayrolls() }, [])

  const fetchPayrolls = async () => {
    setLoading(true)
    try {
      const res = await payrollApi.getAll()
      setPayrolls(res.data)
    } catch (err) {
      toastError(t('hr.payroll.fetchFailed') || 'Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!formStart || !formEnd) return
    setIsProcessing(true)
    try {
      await payrollApi.process({ period_start: formStart, period_end: formEnd, notes: formNotes })
      toastSuccess(t('hr.payroll.processed') || 'Payroll processed successfully')
      setShowForm(false)
      setFormStart('')
      setFormEnd('')
      setFormNotes('')
      fetchPayrolls()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.payroll.processFailed') || 'Failed to process payroll')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayItem = async () => {
    if (!payingItem) return
    setPaying(true)
    try {
      await payrollApi.payItem(payingItem.id)
      toastSuccess(t('hr.payroll.paid') || 'Marked as paid')
      setPayingItem(null)
      if (showDetail) fetchDetail(showDetail.id)
      fetchPayrolls()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.payroll.markPaidFailed') || 'Failed to mark as paid')
    } finally {
      setPaying(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await payrollApi.delete(deleteTarget.id)
      toastSuccess(t('hr.payroll.deleted') || 'Payroll deleted')
      setDeleteTarget(null)
      fetchPayrolls()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.payroll.deleteFailed') || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const fetchDetail = async (id) => {
    try {
      const res = await payrollApi.getById(id)
      setShowDetail(res.data)
    } catch (err) {
      toastError(t('hr.payroll.fetchDetailFailed') || 'Failed to load payroll details')
    }
  }

  const formatCurrency = (amount) => {
    return `${parseFloat(amount || 0).toLocaleString()} ج.م`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
<h1 className="text-2xl font-bold text-foreground">{t('hr.payroll.title')||'Payroll'}</h1>
<p className="text-muted text-sm">{t('hr.payroll.subtitle')||'Process payroll and manage salary payments'}</p>
        </div>
<button onClick={()=>setShowForm(true)}className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-700 transition text-sm">
          <DollarSign className="w-4 h-4" /> {t('hr.payroll.processPayroll') || 'Process Payroll'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : payrolls.length === 0 ? (
<div className="text-center py-12 text-muted">{t('hr.payroll.noPayrolls')||'No payroll runs yet'}</div>
      ) : (
        <div className="space-y-3">
          {payrolls.map(payroll => (
<div key={payroll.id}className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
<Calendar className="w-6 h-6 text-accent"/>
                  </div>
                  <div>
<div className="font-semibold text-foreground">
                      {payroll.period_start} → {payroll.period_end}
                    </div>
<div className="text-sm text-muted">
                      {formatCurrency(payroll.total_amount)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payroll.status] || ''}`}>
                    {t(`hr.payroll.status.${payroll.status}`) || payroll.status}
                  </span>
                  <button onClick={() => fetchDetail(payroll.id)}
className="p-2 text-muted hover:text-primary-600 transition">
                    <Eye className="w-4 h-4" />
                  </button>
                  {payroll.status !== 'paid' && (
                    <button onClick={() => setDeleteTarget(payroll)}
className="p-2 text-muted hover:text-red-600 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Process Payroll Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">{t('hr.payroll.processPayroll')||'Process Payroll'}</h3>
<button onClick={()=>setShowForm(false)}className="text-muted text-foreground"><FileText className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
<div className="bg-warning-soft border border-warning rounded-lg p-3 text-sm text-warning-soft-foreground">
                {t('hr.payroll.processWarning') || 'This will calculate salaries for all active employees based on their base salary and overtime hours.'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.payroll.periodStart')||'Period Start'}</label>
                  <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
                </div>
                <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.payroll.periodEnd')||'Period End'}</label>
                  <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
                </div>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('common.notes')||'Notes'}</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
              </div>
              <div className="flex gap-3 pt-2">
<button onClick={()=>setShowForm(false)}className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground bg-surface-hover text-sm">{t('common.cancel')||'Cancel'}</button>
                <button onClick={handleProcess} disabled={!formStart || !formEnd || isProcessing}
className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isProcessing ? t('hr.payroll.processing') || 'Processing...' : t('hr.payroll.process') || 'Process'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">
                {t('hr.payroll.details') || 'Payroll Details'} — {showDetail.period_start} → {showDetail.period_end}
              </h3>
<button onClick={()=>setShowDetail(null)}className="text-muted text-foreground"><X className="w-5 h-5"/></button>
            </div>
            <div className="mb-4 flex items-center gap-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[showDetail.status]}`}>{t(`hr.payroll.status.${showDetail.status}`) || showDetail.status}</span>
<span className="text-sm text-muted">{t('hr.payroll.total')||'Total'}:<strong>{formatCurrency(showDetail.total_amount)}</strong></span>
            </div>
            {showDetail.items && showDetail.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
<tr className="border-b border-border">
<th className="text-start px-3 py-2 font-medium text-muted">{t('hr.payroll.employee')||'Employee'}</th>
<th className="text-end px-3 py-2 font-medium text-muted">{t('hr.payroll.base')||'Base'}</th>
<th className="text-end px-3 py-2 font-medium text-muted">{t('hr.payroll.overtime')||'Overtime'}</th>
<th className="text-end px-3 py-2 font-medium text-muted">{t('hr.payroll.bonuses')||'Bonuses'}</th>
<th className="text-end px-3 py-2 font-medium text-muted">{t('hr.payroll.deductions')||'Deductions'}</th>
<th className="text-end px-3 py-2 font-medium text-muted">{t('hr.payroll.netPay')||'Net Pay'}</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {showDetail.items.map(item => (
<tr key={item.id}className="border-b border-border">
<td className="px-3 py-2 text-foreground font-medium">{item.employees?.name ||`#${item.employee_id}`}</td>
<td className="px-3 py-2 text-end text-muted">{formatCurrency(item.base_salary)}</td>
<td className="px-3 py-2 text-end text-muted">{formatCurrency(item.overtime_pay)}</td>
<td className="px-3 py-2 text-end text-muted">{formatCurrency(item.bonuses)}</td>
<td className="px-3 py-2 text-end text-danger">{formatCurrency(item.deductions + item.advance_deduction)}</td>
<td className="px-3 py-2 text-end font-semibold text-foreground">{formatCurrency(item.net_pay)}</td>
                        <td className="px-3 py-2 text-end">
                          {item.status === 'pending' ? (
                            <button onClick={() => setPayingItem(item)}
className="text-xs text-success hover:text-green-700 font-medium">
                              {t('hr.payroll.markPaid') || 'Mark Paid'}
                            </button>
                          ) : (
<span className="text-xs text-success flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> {t('hr.payroll.paid') || 'Paid'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
<div className="text-center py-6 text-muted">{t('hr.payroll.noItems')||'No items'}</div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('hr.payroll.deletePayroll') || 'Delete Payroll'}
        message={t('hr.payroll.deleteConfirm') || 'Are you sure you want to delete this payroll run?'}
        type="danger"
        loading={deleting}
      />

      <ConfirmModal
        open={!!payingItem}
        onClose={() => setPayingItem(null)}
        onConfirm={handlePayItem}
        title={t('hr.payroll.markPaid') || 'Mark as Paid'}
        message={t('hr.payroll.markPaidConfirm') || 'Mark this salary payment as paid?'}
        type="warning"
        loading={paying}
      />
    </div>
  )
}
