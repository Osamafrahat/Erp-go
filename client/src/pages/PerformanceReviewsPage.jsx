import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { performanceApi, employeesApi } from '../lib/api'
import { Star, Plus, Eye, Edit2, Trash2, User, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import SearchableSelect from '../components/SearchableSelect'

const STATUS_COLORS = {
draft:'bg-surface-tertiary text-foreground',
completed:'bg-success-soft text-success-soft-foreground',
}

const DEFAULT_CRITERIA_KEYS = [
  'hr.performance.criteria.communication',
  'hr.performance.criteria.punctuality',
  'hr.performance.criteria.teamwork',
  'hr.performance.criteria.qualityOfWork',
  'hr.performance.criteria.initiative',
  'hr.performance.criteria.adaptability',
]

function StarRating({ value, onChange, readonly }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'}`}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => onChange?.(star)}>
<Star className={`w-5 h-5 ${(hover || value)>=star ?'fill-yellow-400 text-warning':'text-foreground'}`}/>
        </button>
      ))}
    </div>
  )
}

export default function PerformanceReviewsPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const { currentUser } = useUserStore()
  const [reviews, setReviews] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editingReview, setEditingReview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formPeriodStart, setFormPeriodStart] = useState('')
  const [formPeriodEnd, setFormPeriodEnd] = useState('')
  const [formRating, setFormRating] = useState(0)
  const [formStrengths, setFormStrengths] = useState('')
  const [formImprovements, setFormImprovements] = useState('')
  const [formGoals, setFormGoals] = useState('')
  const [formComments, setFormComments] = useState('')
  const [formCriteria, setFormCriteria] = useState(
    DEFAULT_CRITERIA_KEYS.map(k => ({ criterion: t(k) || k, rating: 0, comments: '' }))
  )

  const isManager = currentUser?.role === 'MANAGER'

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [revRes, empRes] = await Promise.all([
        performanceApi.getAll(),
        employeesApi.getAll(),
      ])
      setReviews(revRes.data)
      setEmployees(empRes.data)
    } catch (err) {
      toastError(t('hr.performance.fetchFailed') || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormEmployeeId('')
    setFormPeriodStart('')
    setFormPeriodEnd('')
    setFormRating(0)
    setFormStrengths('')
    setFormImprovements('')
    setFormGoals('')
    setFormComments('')
    setFormCriteria(DEFAULT_CRITERIA_KEYS.map(k => ({ criterion: t(k) || k, rating: 0, comments: '' })))
  }

  const handleCreate = async () => {
    if (!formEmployeeId || !formPeriodStart || !formPeriodEnd) return
    setIsSubmitting(true)
    try {
      const data = {
        employee_id: parseInt(formEmployeeId),
        review_period_start: formPeriodStart,
        review_period_end: formPeriodEnd,
        overall_rating: formRating || null,
        strengths: formStrengths,
        improvements: formImprovements,
        goals: formGoals,
        comments: formComments,
        criteria: formCriteria.filter(c => c.criterion),
      }
      if (editingReview) {
        await performanceApi.update(editingReview.id, { ...data, status: 'draft' })
        toastSuccess(t('hr.performance.updated') || 'Review updated')
      } else {
        await performanceApi.create(data)
        toastSuccess(t('hr.performance.created') || 'Review created')
      }
      setShowForm(false)
      setEditingReview(null)
      resetForm()
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.performance.saveFailed') || 'Failed to save review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleComplete = async (review) => {
    try {
      await performanceApi.update(review.id, { status: 'completed' })
      toastSuccess(t('hr.performance.completed') || 'Review marked as completed')
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.performance.completeFailed') || 'Failed to complete review')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await performanceApi.delete(deleteTarget.id)
      toastSuccess(t('hr.performance.deleted') || 'Review deleted')
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toastError(err.response?.data?.error || t('hr.performance.deleteFailed') || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const handleEdit = async (review) => {
    try {
      const res = await performanceApi.getById(review.id)
      const data = res.data
      setEditingReview(data)
      setFormEmployeeId(data.employee_id)
      setFormPeriodStart(data.review_period_start)
      setFormPeriodEnd(data.review_period_end)
      setFormRating(data.overall_rating || 0)
      setFormStrengths(data.strengths || '')
      setFormImprovements(data.improvements || '')
      setFormGoals(data.goals || '')
      setFormComments(data.comments || '')
      if (data.criteria && data.criteria.length > 0) {
        setFormCriteria(data.criteria.map(c => ({ criterion: c.criterion, rating: c.rating || 0, comments: c.comments || '' })))
      }
      setShowForm(true)
    } catch (err) {
      toastError(t('hr.performance.fetchDetailFailed') || 'Failed to load review details')
    }
  }

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId)
    return emp?.name || (t('hr.performance.unknownEmployee') || 'Employee #{id}').replace('{id}', empId)
  }

  const renderStars = (rating) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
<Star key={star}className={`w-4 h-4 ${star<=(rating || 0)?'fill-yellow-400 text-warning':'text-foreground'}`}/>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
<h1 className="text-2xl font-bold text-foreground">{t('hr.performance.title')||'Performance Reviews'}</h1>
<p className="text-muted text-sm">{t('hr.performance.subtitle')||'Track employee performance and evaluations'}</p>
        </div>
        {isManager && (
          <button onClick={() => { resetForm(); setEditingReview(null); setShowForm(true) }}
className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-700 transition text-sm">
            <Plus className="w-4 h-4" /> {t('hr.performance.newReview') || 'New Review'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : reviews.length === 0 ? (
<div className="text-center py-12 text-muted">{t('hr.performance.noReviews')||'No performance reviews yet'}</div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
<div key={review.id}className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center">
<User className="w-5 h-5 text-accent"/>
                  </div>
                  <div>
<div className="font-medium text-foreground">
                      {review.employees?.name || getEmployeeName(review.employee_id)}
                    </div>
<div className="text-xs text-muted">
                      {review.review_period_start} → {review.review_period_end}
                    </div>
<div className="text-xs text-muted">
                      {t('hr.performance.reviewer') || 'Reviewer'}: {review.users?.full_name || t('common.notAvailable') || 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {review.overall_rating && renderStars(review.overall_rating)}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[review.status]}`}>
                    {t(`hr.performance.status.${review.status}`) || review.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setShowDetail(review)}
className="p-2 text-muted hover:text-primary-600 transition"title={t('common.view')||'View'}>
                  <Eye className="w-4 h-4" />
                </button>
                {isManager && review.status === 'draft' && (
                  <>
                    <button onClick={() => handleEdit(review)}
className="p-2 text-muted hover:text-blue-600 transition"title={t('common.edit')||'Edit'}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleComplete(review)}
className="px-3 py-1 text-xs text-success hover:text-green-700 border border-success rounded-lg"title={t('hr.performance.markComplete')||'Mark Complete'}>
                      {t('hr.performance.complete') || 'Complete'}
                    </button>
                    <button onClick={() => setDeleteTarget(review)}
className="p-2 text-muted hover:text-red-600 transition"title={t('common.delete')||'Delete'}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">
                {t('hr.performance.reviewDetails') || 'Review Details'}
              </h3>
<button onClick={()=>setShowDetail(null)}className="text-muted text-foreground"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
<div className="font-medium text-foreground">{showDetail.employees?.name || getEmployeeName(showDetail.employee_id)}</div>
<div className="text-sm text-muted">{showDetail.review_period_start}→{showDetail.review_period_end}</div>
                </div>
                <div className="text-right">
                  {renderStars(showDetail.overall_rating)}
                  <span className={`block mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[showDetail.status]}`}>{t(`hr.performance.status.${showDetail.status}`) || showDetail.status}</span>
                </div>
              </div>
              {showDetail.criteria && showDetail.criteria.length > 0 && (
                <div>
<h4 className="font-medium text-foreground mb-2">{t('hr.performance.criteria')||'Criteria'}</h4>
                  <div className="space-y-2">
                    {showDetail.criteria.map((c, i) => (
<div key={i}className="flex items-center justify-between bg-surface-secondary rounded-lg p-2">
<span className="text-sm text-foreground">{c.criterion}</span>
                        {renderStars(c.rating)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showDetail.strengths && (
                <div>
<h4 className="font-medium text-success text-sm">{t('hr.performance.strengths')||'Strengths'}</h4>
<p className="text-sm text-muted mt-1">{showDetail.strengths}</p>
                </div>
              )}
              {showDetail.improvements && (
                <div>
<h4 className="font-medium text-warning text-sm">{t('hr.performance.improvements')||'Areas for Improvement'}</h4>
<p className="text-sm text-muted mt-1">{showDetail.improvements}</p>
                </div>
              )}
              {showDetail.goals && (
                <div>
<h4 className="font-medium text-accent text-sm">{t('hr.performance.goals')||'Goals'}</h4>
<p className="text-sm text-muted mt-1">{showDetail.goals}</p>
                </div>
              )}
              {showDetail.comments && (
                <div>
<h4 className="font-medium text-foreground text-sm">{t('hr.performance.comments')||'Comments'}</h4>
<p className="text-sm text-muted mt-1">{showDetail.comments}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
<div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
<h3 className="text-lg font-semibold text-foreground">
                {editingReview ? (t('hr.performance.editReview') || 'Edit Review') : (t('hr.performance.newReview') || 'New Review')}
              </h3>
<button onClick={()=>{setShowForm(false);setEditingReview(null);resetForm()}}className="text-muted text-foreground"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.employee')||'Employee'}</label>
                <SearchableSelect
                  options={employees.filter(e => e.is_active).map(e => ({ value: e.id, label: e.name }))}
                  value={formEmployeeId}
                  onChange={setFormEmployeeId}
                  placeholder={t('hr.performance.selectEmployee') || 'Search employee...'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.periodStart')||'Period Start'}</label>
                  <input type="date" value={formPeriodStart} onChange={e => setFormPeriodStart(e.target.value)}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
                </div>
                <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.periodEnd')||'Period End'}</label>
                  <input type="date" value={formPeriodEnd} onChange={e => setFormPeriodEnd(e.target.value)}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
                </div>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.overallRating')||'Overall Rating'}</label>
                <StarRating value={formRating} onChange={setFormRating} />
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-2">{t('hr.performance.criteria')||'Criteria'}</label>
                <div className="space-y-2">
                  {formCriteria.map((c, i) => (
<div key={i}className="flex items-center gap-3 bg-surface-secondary rounded-lg p-2">
                      <input type="text" value={c.criterion} onChange={e => {
                        const updated = [...formCriteria]
                        updated[i].criterion = e.target.value
                        setFormCriteria(updated)
                      }}
className="flex-1 px-2 py-1 border border-border rounded bg-surface text-foreground text-sm"/>
                      <StarRating value={c.rating} onChange={val => {
                        const updated = [...formCriteria]
                        updated[i].rating = val
                        setFormCriteria(updated)
                      }} />
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormCriteria([...formCriteria, { criterion: '', rating: 0, comments: '' }])}
className="text-xs text-accent hover:text-primary-700">
                    + {t('hr.performance.addCriterion') || 'Add Criterion'}
                  </button>
                </div>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.strengths')||'Strengths'}</label>
                <textarea value={formStrengths} onChange={e => setFormStrengths(e.target.value)} rows={2}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.improvements')||'Areas for Improvement'}</label>
                <textarea value={formImprovements} onChange={e => setFormImprovements(e.target.value)} rows={2}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.goals')||'Goals'}</label>
                <textarea value={formGoals} onChange={e => setFormGoals(e.target.value)} rows={2}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
              </div>
              <div>
<label className="block text-sm font-medium text-foreground mb-1">{t('hr.performance.comments')||'Comments'}</label>
                <textarea value={formComments} onChange={e => setFormComments(e.target.value)} rows={2}
className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground text-sm"/>
              </div>
              <div className="flex gap-3 pt-2">
<button onClick={()=>{setShowForm(false);setEditingReview(null);resetForm()}}className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground bg-surface-hover text-sm">{t('common.cancel')||'Cancel'}</button>
                <button onClick={handleCreate} disabled={!formEmployeeId || !formPeriodStart || !formPeriodEnd || isSubmitting}
className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                  {isSubmitting ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('hr.performance.deleteReview') || 'Delete Review'}
        message={t('hr.performance.deleteConfirm') || 'Are you sure you want to delete this performance review?'}
        type="danger"
        loading={deleting}
      />
    </div>
  )
}
