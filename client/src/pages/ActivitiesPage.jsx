import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { activitiesApi } from '../lib/api'
import { Activity, Search, User, ShoppingCart, Package, Truck, Tag, DollarSign, RotateCcw, Users, ClipboardList } from 'lucide-react'

const ACTION_ICONS = {
  created: { icon: '➕', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  updated: { icon: '✏️', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  deleted: { icon: '🗑️', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  refunded: { icon: '💸', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  toggled_active: { icon: '🔄', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  logged_in: { icon: '🔑', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
  logged_out: { icon: '🚪', color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20' },
}

const ENTITY_ICONS = {
  order: ShoppingCart,
  product: Package,
  supplier: Truck,
  promotion: Tag,
  expense: DollarSign,
  user: Users,
  customer: User,
  employee: Users,
  category: ClipboardList,
  refund: RotateCcw,
  auth: Activity,
}

const ACTION_OPTIONS = [
  { value: '', labelEn: 'All Actions', labelAr: 'جميع الإجراءات' },
  { value: 'created', labelEn: 'Created', labelAr: 'إنشاء' },
  { value: 'updated', labelEn: 'Updated', labelAr: 'تعديل' },
  { value: 'deleted', labelEn: 'Deleted', labelAr: 'حذف' },
  { value: 'refunded', labelEn: 'Refunded', labelAr: 'استرجاع' },
  { value: 'toggled_active', labelEn: 'Status Changed', labelAr: 'تغيير الحالة' },
  { value: 'logged_in', labelEn: 'Login', labelAr: 'تسجيل دخول' },
  { value: 'logged_out', labelEn: 'Logout', labelAr: 'تسجيل خروج' },
]

const ENTITY_OPTIONS = [
  { value: '', labelEn: 'All Types', labelAr: 'جميع الأنواع' },
  { value: 'order', labelEn: 'Orders', labelAr: 'الطلبات' },
  { value: 'product', labelEn: 'Products', labelAr: 'المنتجات' },
  { value: 'supplier', labelEn: 'Suppliers', labelAr: 'الموردين' },
  { value: 'promotion', labelEn: 'Promotions', labelAr: 'العروض' },
  { value: 'expense', labelEn: 'Expenses', labelAr: 'المصروفات' },
  { value: 'user', labelEn: 'Users', labelAr: 'المستخدمين' },
  { value: 'customer', labelEn: 'Customers', labelAr: 'العملاء' },
  { value: 'employee', labelEn: 'Employees', labelAr: 'الموظفين' },
  { value: 'category', labelEn: 'Categories', labelAr: 'الفئات' },
]

export default function ActivitiesPage() {
  const { t, language } = useAppStore()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchActivities()
    fetchStats()
  }, [pagination.page, actionFilter, entityFilter])

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const response = await activitiesApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        search: search || undefined,
      })
      setActivities(response.data.data || [])
      setPagination(prev => ({ ...prev, ...(response.data.pagination || {}) }))
    } catch (err) {
      console.error('Failed to fetch activities:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await activitiesApi.getStats()
      setStats(response.data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchActivities()
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const formatDetails = (details, action) => {
    if (!details || Object.keys(details).length === 0) return null
    const items = []
    if (details.total) items.push(`Total: ${details.total} EGP`)
    if (details.amount) items.push(`Amount: ${details.amount} EGP`)
    if (details.reason) items.push(`Reason: ${details.reason}`)
    if (details.payment_method) items.push(`Method: ${details.payment_method}`)
    if (details.items_count) items.push(`${details.items_count} items`)
    if (details.customer_id) items.push('Customer linked')
    return items.length > 0 ? items.join(' • ') : null
  }

  const label = (en, ar) => language === 'ar' ? ar : en

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-7 h-7" />
            {t('activities.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{t('activities.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('activities.todayActions')}</p>
            <p className="text-2xl font-bold">{stats.totalToday}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('activities.totalActions')}</p>
            <p className="text-2xl font-bold">{stats.totalAll}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('activities.activeUsers')}</p>
            <p className="text-2xl font-bold">{Object.keys(stats.byUser || {}).length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('activities.entityTypes')}</p>
            <p className="text-2xl font-bold">{Object.keys(stats.byEntity || {}).length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('activities.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            {ACTION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{label(opt.labelEn, opt.labelAr)}</option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            {ENTITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{label(opt.labelEn, opt.labelAr)}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('common.search')}
          </button>
        </form>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Activity className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('activities.noActivities')}</h3>
          <p className="text-gray-500 dark:text-gray-400">{t('activities.noActivitiesHint')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-start px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('activities.time')}</th>
                  <th className="text-start px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('activities.user')}</th>
                  <th className="text-start px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('activities.action')}</th>
                  <th className="text-start px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('activities.entity')}</th>
                  <th className="text-start px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">{t('activities.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {activities.map((activity) => {
                  const actionStyle = ACTION_ICONS[activity.action] || ACTION_ICONS.created
                  const EntityIcon = ENTITY_ICONS[activity.entity_type] || ClipboardList
                  const detailText = formatDetails(activity.details, activity.action)

                  return (
                    <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm text-start whitespace-nowrap">
                        <div>{new Date(activity.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{new Date(activity.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-start">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-primary-600" />
                          </div>
                          <span className="font-medium">{activity.user_name || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-start">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionStyle.color}`}>
                          {actionStyle.icon} {label(
                            activity.action.charAt(0).toUpperCase() + activity.action.slice(1).replace('_', ' '),
                            activity.action === 'created' ? 'إنشاء' :
                            activity.action === 'updated' ? 'تعديل' :
                            activity.action === 'deleted' ? 'حذف' :
                            activity.action === 'refunded' ? 'استرجاع' :
                            activity.action === 'toggled_active' ? 'تغيير الحالة' :
                            activity.action === 'logged_in' ? 'تسجيل دخول' :
                            activity.action === 'logged_out' ? 'تسجيل خروج' : activity.action
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-start">
                        <div className="flex items-center gap-2">
                          <EntityIcon className="w-4 h-4 text-gray-400" />
                          <span className="capitalize">{label(
                            activity.entity_type,
                            activity.entity_type === 'order' ? 'طلب' :
                            activity.entity_type === 'product' ? 'منتج' :
                            activity.entity_type === 'supplier' ? 'مورد' :
                            activity.entity_type === 'promotion' ? 'عرض' :
                            activity.entity_type === 'expense' ? 'مصروف' :
                            activity.entity_type === 'user' ? 'مستخدم' :
                            activity.entity_type === 'customer' ? 'عميل' :
                            activity.entity_type === 'employee' ? 'موظف' :
                            activity.entity_type === 'category' ? 'فئة' :
                            activity.entity_type === 'auth' ? 'مصادقة' : activity.entity_type
                          )}</span>
                          {activity.entity_name && (
                            <span className="text-gray-500 dark:text-gray-400">— {activity.entity_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-start text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {detailText || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{t('activities.showing')} {activities.length} {t('activities.of')} {pagination.total}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                >
                  {t('common.previous')}
                </button>
                <span className="px-3 py-1">{pagination.page} / {pagination.totalPages}</span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
