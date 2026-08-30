import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { journalsApi, accountsApi } from '../lib/api'
import { translateDescription } from '../lib/translateDescription'
import { Plus, Search, Eye, RotateCcw, Save, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function JournalEntriesPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reverseTarget, setReverseTarget] = useState(null)
  const [reversing, setReversing] = useState(false)

  const getAccountName = (account) => {
    if (!account) return ''
    const key = `accounting.account.${account.code}`
    const translated = t(key)
    return translated !== key ? translated : account.name
  }

  const translateDesc = (desc) => translateDescription(t, desc)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { accountId: '', debit: '', credit: '', description: '' },
      { accountId: '', debit: '', credit: '', description: '' },
    ],
  })

  useEffect(() => { fetchEntries(); fetchAccounts() }, [page, search])

  const fetchEntries = async () => {
    try {
      const { data } = await journalsApi.getAll({ page, limit: 20, search })
      setEntries(data.data)
      setTotal(data.total)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchAccounts = async () => {
    try {
      const { data } = await accountsApi.getAll()
      setAccounts(data)
    } catch (err) { console.error(err) }
  }

  const addLine = () => {
    setFormData({ ...formData, lines: [...formData.lines, { accountId: '', debit: '', credit: '', description: '' }] })
  }

  const removeLine = (i) => {
    if (formData.lines.length <= 2) return
    setFormData({ ...formData, lines: formData.lines.filter((_, idx) => idx !== i) })
  }

  const updateLine = (i, field, value) => {
    const newLines = [...formData.lines]
    newLines[i] = { ...newLines[i], [field]: value }
    setFormData({ ...formData, lines: newLines })
  }

  const totalDebit = formData.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = formData.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const handleSubmit = async () => {
    if (!formData.description) return toastError(t('accounting.descRequired'))
    if (!isBalanced) return toastError(t('accounting.entryNotBalanced'))
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await journalsApi.create({
        ...formData,
        lines: formData.lines.filter(l => l.accountId && (l.debit || l.credit)),
      })
      toastSuccess(t('accounting.entryCreated'))
      setShowForm(false)
      setFormData({ date: new Date().toISOString().split('T')[0], description: '', reference: '', lines: [{ accountId: '', debit: '', credit: '', description: '' }, { accountId: '', debit: '', credit: '', description: '' }] })
      fetchEntries()
    } catch (err) {
      toastError(err.response?.data?.error || 'Failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReverse = async (id) => {
    setReversing(true)
    try {
      await journalsApi.reverse(id)
      toastSuccess(t('accounting.entryReversed'))
      fetchEntries()
      setReverseTarget(null)
    } catch (err) {
      toastError(err.response?.data?.error || 'Failed')
    } finally {
      setReversing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('accounting.journalEntries') || 'Journal Entries'}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('accounting.journalEntriesDesc') || 'Double-entry bookkeeping'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('accounting.newEntry') || 'New Entry'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('common.search') || 'Search...'} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">{t('accounting.newEntry') || 'New Journal Entry'}</h3>
            <div className="grid grid-cols-3 gap-3">
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
              <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder={t('accounting.description') || 'Description'} className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <input value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder={t('accounting.reference') || 'Reference (optional)'} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500" />

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <div className="col-span-4">{t('accounting.account') || 'Account'}</div>
                <div className="col-span-2 text-end">{t('accounting.debit') || 'Debit'}</div>
                <div className="col-span-2 text-end">{t('accounting.credit') || 'Credit'}</div>
                <div className="col-span-3">{t('accounting.description') || 'Description'}</div>
                <div className="col-span-1" />
              </div>
              {formData.lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select value={line.accountId} onChange={e => updateLine(i, 'accountId', e.target.value)} className="col-span-4 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none">
                    <option value="">{t('accounting.selectAccount') || 'Select...'}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {getAccountName(a)}</option>)}
                  </select>
                  <input type="number" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} placeholder="0" className="col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-end outline-none" />
                  <input type="number" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} placeholder="0" className="col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-end outline-none" />
                  <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} className="col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm outline-none" />
                  <button onClick={() => removeLine(i)} className="col-span-1 flex items-center justify-center text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <button onClick={addLine} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ {t('accounting.addLine') || 'Add Line'}</button>

            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="flex gap-4 text-sm">
                <span className={`font-medium ${Math.abs(totalDebit - totalCredit) > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                  {t('accounting.debit') || 'Debit'}: {totalDebit.toFixed(2)}
                </span>
                <span className={`font-medium ${Math.abs(totalDebit - totalCredit) > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                  {t('accounting.credit') || 'Credit'}: {totalCredit.toFixed(2)}
                </span>
                {isBalanced && <span className="text-green-600 font-bold">✓ Balanced</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={handleSubmit} disabled={!isBalanced} className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl font-medium flex items-center gap-2">
                  <Save className="w-4 h-4" /> {t('common.save') || 'Save'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium">{t('common.cancel') || 'Cancel'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{showDetail.entry_number}</h3>
              <button onClick={() => setShowDetail(null)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('common.date')}:</span> {showDetail.date}</div>
              <div><span className="text-gray-500">{t('accounting.reference')}:</span> {showDetail.reference || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500">{t('accounting.description')}:</span> {translateDesc(showDetail.description)}</div>
                <div><span className="text-gray-500">{t('accounting.source')}:</span> {t('accounting.source' + (showDetail.source_type || 'manual').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''))}</div>
                <div><span className="text-gray-500">{t('accounting.status')}:</span> {showDetail.is_posted ? t('accounting.posted') : t('accounting.draft')} {showDetail.is_reversed ? `(${t('accounting.reversed')})` : ''}</div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                  <th className="text-start py-2">{t('accounting.account')}</th>
                  <th className="text-end py-2">{t('accounting.debit')}</th>
                  <th className="text-end py-2">{t('accounting.credit')}</th>
                </tr>
              </thead>
              <tbody>
                {showDetail.journal_entry_lines?.map(line => (
                  <tr key={line.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2">{line.accounts?.code} - {getAccountName(line.accounts)}</td>
                    <td className="py-2 text-end font-mono">{line.debit > 0 ? line.debit.toFixed(2) : ''}</td>
                    <td className="py-2 text-end font-mono">{line.credit > 0 ? line.credit.toFixed(2) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2 border-gray-300 dark:border-gray-600">
                  <td className="py-2">{t('common.total')}</td>
                  <td className="py-2 text-end font-mono">{showDetail.journal_entry_lines?.reduce((s, l) => s + l.debit, 0).toFixed(2)}</td>
                  <td className="py-2 text-end font-mono">{showDetail.journal_entry_lines?.reduce((s, l) => s + l.credit, 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="text-start px-6 py-3 font-medium">{t('accounting.entryNumber') || 'Entry #'}</th>
                <th className="text-start px-6 py-3 font-medium">{t('common.date') || 'Date'}</th>
                <th className="text-start px-6 py-3 font-medium">{t('accounting.description') || 'Description'}</th>
                <th className="text-start px-6 py-3 font-medium">{t('accounting.source') || 'Source'}</th>
                <th className="text-end px-6 py-3 font-medium">{t('accounting.debit') || 'Debit'}</th>
                <th className="text-end px-6 py-3 font-medium">{t('accounting.credit') || 'Credit'}</th>
                <th className="text-end px-6 py-3 font-medium">{t('common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const totalDr = entry.journal_entry_lines?.reduce((s, l) => s + l.debit, 0) || 0
                const totalCr = entry.journal_entry_lines?.reduce((s, l) => s + l.credit, 0) || 0
                return (
                  <tr key={entry.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-3 text-sm font-mono font-bold">{entry.entry_number}</td>
                    <td className="px-6 py-3 text-sm">{entry.date}</td>
                    <td className="px-6 py-3 text-sm">{translateDesc(entry.description)}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className="px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-700">{t('accounting.source' + entry.source_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''))}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-end font-mono">{totalDr.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-end font-mono">{totalCr.toFixed(2)}</td>
                    <td className="px-6 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setShowDetail(entry)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-600"><Eye className="w-4 h-4" /></button>
                        {!entry.is_reversed && entry.is_posted && (
                          <button onClick={() => setReverseTarget(entry.id)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-orange-600" title="Reverse"><RotateCcw className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {entries.length === 0 && <p className="text-center py-8 text-gray-400">{t('common.noData') || 'No entries found'}</p>}
          {total > 20 && (
            <div className="flex justify-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-50 text-sm">{t('accounting.prev')}</button>
              <span className="px-3 py-1.5 text-sm text-gray-500">{t('accounting.page')} {page}</span>
              <button disabled={entries.length < 20} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-50 text-sm">{t('accounting.next')}</button>
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        open={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={() => handleReverse(reverseTarget)}
        title={t('accounting.reverseEntry') || 'Reverse Journal Entry'}
        message={t('accounting.reverseConfirm') || 'Are you sure you want to reverse this journal entry?'}
        type="warning"
        confirmText={t('accounting.reverse') || 'Reverse'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={reversing}
      />
    </div>
  )
}
