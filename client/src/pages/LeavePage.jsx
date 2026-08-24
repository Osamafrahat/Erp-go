import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { leaveApi, employeesApi } from '../lib/api'
import { Calendar, Plus, Check, X, Clock, User, Filter } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import SearchableSelect from '../components/SearchableSelect'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export default function LeavePage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const { currentUser } = useUserStore()
  const [employees, setEmployees] = useState([])
  const [leaveTypes, setLeaveTypes] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [activeTab, setActiveTab] = useState('requests')
  const [filterStatus, setFilterStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [approveTarget, setApproveTarget] = useState(null)
  const [approveAction, setApproveAction] = useState('approved')
  const [approving, setApproving] = useState(false)

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formLeaveTypeId, setFormLeaveTypeId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formReason, setFormReason] = useState('')

  // Leave type form
  const [typeName, setTypeName] = useState('')
  const [typeDays, setTypeDays] = useState(21)
  const [typePaid, setTypePaid] = useState(true)

  const isManager = currentUser?.role === 'MANAGER'

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [empRes, typesRes, reqRes] = await Promise.all([
        employeesApi.getAll(),
        leaveApi.getTypes(),
        leaveApi.getRequests(),
      ])
      setEmployees(empRes.data)
      setLeaveTypes(typesRes.data)
      setRequests(reqRes.data)
    } catch (err) {
      toastError(t('hr.leave.fetchFailed') || 'Failed to load leave data')
    } finally {
      setLoading(false)
    }
  }

  const filteredRequests = useMemo(() => {
    if (!filterStatus) return requests
    return requests.filter(r => r.status === filterStatus)
  }, [requests, filterStatus])

  const handleCreateRequest = async () => {
    if (!formEmployeeId || !formLeaveTypeId || !formStartDate || !formEndDate) return
    setIsSubmitting(true)
    try {
      await leaveApi.createRequest({
        employee_id: parseInt(formEmployeeId),
        leave_type_id: parseInt(formLeaveTypeId),
        start_date: formStartDate,
        end_date: formEndDate,
        reason: formReason,
      })
      toastSuccess(t('hr.leave.requestCreated') || 'Leave request submitted')
      setShowForm(false)
      resetForm()
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.leave.createFailed') || 'Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = async () => {
    if (!approveTarget) return
    setApproving(true)
    try {
      await leaveApi.approveRequest(approveTarget.id, { status: approveAction })
      toastSuccess(t('hr.leave.requestUpdated') || `Leave request ${approveAction}`)
      setApproveTarget(null)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.leave.updateFailed') || 'Failed to update request')
    } finally {
      setApproving(false)
    }
  }

  const handleDeleteRequest = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await leaveApi.deleteRequest(deleteTarget.id)
      toastSuccess(t('hr.leave.requestDeleted') || 'Request deleted')
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.leave.deleteFailed') || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateType = async () => {
    if (!typeName) return
    setIsSubmitting(true)
    try {
      await leaveApi.createType({ name: typeName, days_per_year: typeDays, is_paid: typePaid })
      toastSuccess(t('hr.leave.typeCreated') || 'Leave type created')
      setShowTypeForm(false)
      setTypeName('')
      setTypeDays(21)
      setTypePaid(true)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.leave.createTypeFailed') || 'Failed to create leave type')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormEmployeeId('')
    setFormLeaveTypeId('')
    setFormStartDate('')
    setFormEndDate('')
    setFormReason('')
  }

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId)
    return emp?.name || (t('hr.leave.unknownEmployee') || 'Employee #{id}').replace('{id}', empId)
  }

  const getTypeName = (typeId) => {
    const found = leaveTypes.find(lt => lt.id === typeId)
    return found?.name || (t('hr.leave.unknownType') || 'Type #{id}').replace('{id}', typeId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.leave.title') || 'Leave Management'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('hr.leave.subtitle') || 'Manage leave requests, types, and balances'}</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <button onClick={() => setShowTypeForm(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">
              <Plus className="w-4 h-4" /> {t('hr.leave.addType') || 'Add Type'}
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm">
            <Plus className="w-4 h-4" /> {t('hr.leave.newRequest') || 'New Request'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {['requests', 'types'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
            {tab === 'requests' ? (t('hr.leave.requests') || 'Requests') : (t('hr.leave.types') || 'Types')}
          </button>
        ))}
      </div>

      {activeTab === 'requests' && (
        <>
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            {[
              { value: '', label: t('hr.leave.all') || 'All' },
              { value: 'pending', label: t('hr.leave.status.pending') || 'Pending' },
              { value: 'approved', label: t('hr.leave.status.approved') || 'Approved' },
              { value: 'rejected', label: t('hr.leave.status.rejected') || 'Rejected' }
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setFilterStatus(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filterStatus === value ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('hr.leave.noRequests') || 'No leave requests'}</div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{req.employees?.name || getEmployeeName(req.employee_id)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{req.leave_types?.name || getTypeName(req.leave_type_id)}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {t(`hr.leave.status.${req.status}`) || req.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {req.start_date} → {req.end_date}</span>
                    <span>{req.days} {t('hr.leave.days') || 'days'}</span>
                    {req.reason && <span className="text-gray-400">"{req.reason}"</span>}
                  </div>
                  {isManager && req.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setApproveTarget(req); setApproveAction('approved') }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium">
                        <Check className="w-3.5 h-3.5" /> {t('hr.leave.approve') || 'Approve'}
                      </button>
                      <button onClick={() => { setApproveTarget(req); setApproveAction('rejected') }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium">
                        <X className="w-3.5 h-3.5" /> {t('hr.leave.reject') || 'Reject'}
                      </button>
                      <button onClick={() => setDeleteTarget(req)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs">
                        {t('common.delete') || 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'types' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaveTypes.map(type => (
            <div key={type.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{type.name}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${type.is_paid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {type.is_paid ? (t('hr.leave.paid') || 'Paid') : (t('hr.leave.unpaid') || 'Unpaid')}
                </span>
              </div>
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{type.days_per_year}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('hr.leave.daysPerYear') || 'days per year'}</div>
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.leave.newRequest') || 'New Leave Request'}</h3>
              <button onClick={() => { setShowForm(false); resetForm() }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.employee') || 'Employee'}</label>
                <SearchableSelect
                  options={employees.filter(e => e.is_active).map(e => ({ value: e.id, label: e.name }))}
                  value={formEmployeeId}
                  onChange={setFormEmployeeId}
                  placeholder={t('hr.leave.selectEmployee') || 'Search employee...'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.leaveType') || 'Leave Type'}</label>
                <SearchableSelect
                  options={leaveTypes.map(lt => ({ value: lt.id, label: `${lt.name} (${lt.days_per_year}d)` }))}
                  value={formLeaveTypeId}
                  onChange={setFormLeaveTypeId}
                  placeholder={t('hr.leave.selectType') || 'Search type...'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.startDate') || 'Start Date'}</label>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.endDate') || 'End Date'}</label>
                  <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.reason') || 'Reason'}</label>
                <textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder={t('hr.leave.reasonPlaceholder') || 'Reason for leave...'} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); resetForm() }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('common.cancel') || 'Cancel'}</button>
                <button onClick={handleCreateRequest} disabled={!formEmployeeId || !formLeaveTypeId || !formStartDate || !formEndDate || isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? t('common.saving') || 'Saving...' : t('hr.leave.submit') || 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Leave Type Modal */}
      {showTypeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('hr.leave.addType') || 'Add Leave Type'}</h3>
              <button onClick={() => setShowTypeForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.typeName') || 'Name'}</label>
                <input type="text" value={typeName} onChange={e => setTypeName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder={t('hr.leave.typeNamePlaceholder') || 'e.g. Annual Leave'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hr.leave.daysPerYear') || 'Days Per Year'}</label>
                <input type="number" value={typeDays} onChange={e => setTypeDays(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPaid" checked={typePaid} onChange={e => setTypePaid(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600" />
                <label htmlFor="isPaid" className="text-sm text-gray-700 dark:text-gray-300">{t('hr.leave.isPaid') || 'Paid leave'}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowTypeForm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('common.cancel') || 'Cancel'}</button>
                <button onClick={handleCreateType} disabled={!typeName || isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
        title={approveAction === 'approved' ? (t('hr.leave.approve') || 'Approve Leave') : (t('hr.leave.reject') || 'Reject Leave')}
        message={approveAction === 'approved' ? (t('hr.leave.approveConfirm') || 'Approve this leave request?') : (t('hr.leave.rejectConfirm') || 'Reject this leave request?')}
        type={approveAction === 'approved' ? 'warning' : 'danger'}
        loading={approving}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRequest}
        title={t('hr.leave.deleteRequest') || 'Delete Request'}
        message={t('hr.leave.deleteConfirm') || 'Are you sure you want to delete this leave request?'}
        type="danger"
        loading={deleting}
      />
    </div>
  )
}
