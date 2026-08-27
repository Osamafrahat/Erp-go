import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { superAdminApi } from '../lib/api'
import { Search, Shield, Building2, Users, Package, TrendingUp, AlertTriangle, CheckCircle, Plus, Trash2, LogIn, Clock, DollarSign, Edit3, X, Save, Eye, Activity } from 'lucide-react'

const tierColors = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pro: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  enterprise: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const statusColors = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  past_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function SuperAdminPage() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const [tab, setTab] = useState('tenants')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Shield className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">{t('admin.accessDenied') || 'Access Denied'}</p>
        <p className="text-sm">{t('admin.roleRequired') || 'Super Admin role required'}</p>
      </div>
    )
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6" />
          {t('admin.title') || 'Super Admin Panel'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('admin.subtitle') || 'Manage all tenants and subscriptions'}
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'tenants', label: t('admin.tabTenants') || 'Tenants', icon: Building2 },
          { key: 'plans', label: t('admin.tabPlans') || 'Plans', icon: DollarSign },
          { key: 'activity', label: t('admin.tabActivity') || 'Activity', icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'tenants' && <TenantsTab t={t} showToast={showToast} />}
      {tab === 'plans' && <PlansTab t={t} showToast={showToast} />}
      {tab === 'activity' && <ActivityTab t={t} />}
    </div>
  )
}

function TenantsTab({ t, showToast }) {
  const [tenants, setTenants] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailTenant, setDetailTenant] = useState(null)
  const limit = 15

  const fetchTenants = useCallback(async () => {
    try {
      const params = { page, limit }
      if (search) params.search = search
      if (filterStatus) params.status = filterStatus
      if (filterTier) params.tier = filterTier
      const { data } = await superAdminApi.getTenants(params)
      setTenants(data.tenants || [])
      setTotal(data.total || 0)
    } catch {
      setTenants([])
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterTier])

  const fetchStats = async () => {
    try {
      const { data } = await superAdminApi.getStats()
      setStats(data)
    } catch {}
  }

  useEffect(() => { fetchTenants() }, [fetchTenants])
  useEffect(() => { fetchStats() }, [])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleChangeTier = async (tenantId, newTier) => {
    setActionLoading(tenantId)
    try {
      await superAdminApi.updateTenant(tenantId, { subscription_tier: newTier })
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscription_tier: newTier } : t))
      showToast(t('admin.tierUpdated') || 'Tier updated')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (tenantId, currentStatus) => {
    setActionLoading(tenantId)
    try {
      const newStatus = currentStatus === 'active' ? 'cancelled' : 'active'
      await superAdminApi.updateTenant(tenantId, { subscription_status: newStatus })
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscription_status: newStatus } : t))
      showToast(t('admin.tierUpdated') || 'Updated')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleImpersonate = async (tenantId) => {
    if (!window.confirm(t('admin.impersonateConfirm') || 'Login as this tenant admin?')) return
    setActionLoading(tenantId)
    try {
      const { data } = await superAdminApi.impersonate(tenantId)
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('tenant_id', String(data.user.tenant_id))
      window.location.href = '/dashboard'
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (tenantId, tenantName) => {
    if (!window.confirm(`${t('admin.deleteConfirm') || 'Permanently delete this tenant and ALL its data?'}\n\n${tenantName}`)) return
    setActionLoading(tenantId)
    try {
      await superAdminApi.deleteTenant(tenantId)
      setTenants(prev => prev.filter(t => t.id !== tenantId))
      showToast(t('admin.tenantDeleted') || 'Deleted')
      fetchStats()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('admin.totalTenants') || 'Total Tenants', value: stats?.total_tenants ?? '...', icon: Building2, color: 'text-gray-600 dark:text-gray-400' },
          { label: t('admin.active') || 'Active', value: stats?.active_tenants ?? '...', icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
          { label: t('admin.trial') || 'Trial', value: stats?.trialing_tenants ?? '...', icon: AlertTriangle, color: 'text-blue-600 dark:text-blue-400' },
          { label: t('admin.mrr') || 'MRR', value: `${stats?.mrr ?? 0} EGP`, icon: TrendingUp, color: 'text-primary-600 dark:text-primary-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder={t('admin.searchPlaceholder') || 'Search tenants...'}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            >
              <option value="">{t('admin.allStatuses') || 'All Statuses'}</option>
              <option value="active">{t('admin.active') || 'Active'}</option>
              <option value="trialing">{t('admin.trial') || 'Trial'}</option>
              <option value="cancelled">{t('admin.activate')?.replace('Activate','Cancelled') || 'Cancelled'}</option>
            </select>
            <select
              value={filterTier}
              onChange={(e) => { setFilterTier(e.target.value); setPage(1) }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            >
              <option value="">{t('admin.allTiers') || 'All Tiers'}</option>
              <option value="free">{t('admin.free') || 'Free'}</option>
              <option value="pro">{t('admin.pro') || 'Pro'}</option>
              <option value="enterprise">{t('admin.enterprise') || 'Enterprise'}</option>
            </select>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('admin.createNew') || 'Create Tenant'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium">{t('admin.colName') || 'Name'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colTier') || 'Tier'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colStatus') || 'Status'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colUsers') || 'Users'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colProducts') || 'Products'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colOrders') || 'Orders'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colCreated') || 'Created'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colActions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{tenant.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={tenant.subscription_tier}
                        onChange={(e) => handleChangeTier(tenant.id, e.target.value)}
                        disabled={actionLoading === tenant.id}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${tierColors[tenant.subscription_tier] || tierColors.free}`}
                      >
                        <option value="free">{t('admin.free') || 'Free'}</option>
                        <option value="pro">{t('admin.pro') || 'Pro'}</option>
                        <option value="enterprise">{t('admin.enterprise') || 'Enterprise'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[tenant.subscription_status] || statusColors.cancelled}`}>
                        {tenant.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <Users className="w-3.5 h-3.5 inline mr-1" />
                      {tenant.user_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <Package className="w-3.5 h-3.5 inline mr-1" />
                      {tenant.product_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {tenant.order_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDetailTenant(tenant)}
                          className="text-xs p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                          title={t('admin.viewDetails') || 'View Details'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleImpersonate(tenant.id)}
                          disabled={actionLoading === tenant.id || tenant.subscription_status === 'cancelled'}
                          className="text-xs p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 disabled:opacity-50"
                          title={t('admin.impersonate') || 'Login as Tenant'}
                        >
                          <LogIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSuspend(tenant.id, tenant.subscription_status)}
                          disabled={actionLoading === tenant.id}
                          className={`text-xs p-1.5 rounded-lg ${
                            tenant.subscription_status === 'active'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                              : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                          } disabled:opacity-50`}
                          title={tenant.subscription_status === 'active' ? (t('admin.suspend') || 'Suspend') : (t('admin.activate') || 'Activate')}
                        >
                          {tenant.subscription_status === 'active' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(tenant.id, tenant.name)}
                          disabled={actionLoading === tenant.id}
                          className="text-xs p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50"
                          title={t('admin.deleteTenant') || 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      {t('admin.noTenants') || 'No tenants found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-gray-500 dark:text-gray-400">{page}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateTenantModal t={t} showToast={showToast} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchTenants(); fetchStats() }} />}
      {detailTenant && <TenantDetailModal t={t} tenantId={detailTenant.id} onClose={() => setDetailTenant(null)} />}
    </>
  )
}

function CreateTenantModal({ t, showToast, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', adminUsername: '', adminPassword: '', adminEmail: '', adminFullName: '', tier: 'free' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await superAdminApi.createTenant(form)
      showToast(t('admin.tenantCreated') || 'Tenant created')
      onCreated()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.createNew') || 'Create Tenant'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('admin.storeName') || 'Store Name'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} placeholder={t('admin.adminFullName') || 'Admin Full Name'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} placeholder={t('admin.adminUsername') || 'Admin Username'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder={t('admin.adminEmail') || 'Admin Email'} type="email" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder={t('admin.adminPassword') || 'Admin Password'} type="password" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required minLength={8} />
          <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="free">{t('admin.free') || 'Free'}</option>
            <option value="pro">{t('admin.pro') || 'Pro'}</option>
            <option value="enterprise">{t('admin.enterprise') || 'Enterprise'}</option>
          </select>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{t('admin.cancel') || 'Cancel'}</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{loading ? '...' : (t('admin.confirmCreate') || 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TenantDetailModal({ t, tenantId, onClose }) {
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await superAdminApi.getTenant(tenantId)
        setTenant(data)
      } catch {} finally { setLoading(false) }
    })()
  }, [tenantId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.details') || 'Tenant Details'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : tenant ? (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('admin.totalTenants')?.replace('Total ','') || 'Users', value: tenant.user_count },
                { label: t('admin.colProducts') || 'Products', value: tenant.product_count },
                { label: t('admin.colOrders') || 'Orders', value: tenant.order_count },
                { label: t('admin.colTier') || 'Tier', value: tenant.subscription_tier },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            {tenant.users?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.colUsers') || 'Users'}</h3>
                <div className="space-y-1">
                  {tenant.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{u.username}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-2">{u.role}</span>
                      </div>
                      <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-600'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tenant.recent_orders?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.colOrders') || 'Recent Orders'}</h3>
                <div className="space-y-1">
                  {tenant.recent_orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <span className="text-gray-900 dark:text-white">{o.order_number}</span>
                      <span className="text-gray-500 dark:text-gray-400">{o.total_amount} EGP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PlansTab({ t, showToast }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await superAdminApi.getPlans()
        setPlans(data || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  const handleEdit = (plan) => {
    setEditing(plan.id)
    setEditForm({
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_products: plan.max_products,
      max_users: plan.max_users,
      max_orders_monthly: plan.max_orders_monthly,
    })
  }

  const handleSave = async (planId) => {
    setSaving(true)
    try {
      const { data } = await superAdminApi.updatePlan(planId, editForm)
      setPlans(prev => prev.map(p => p.id === planId ? data : p))
      setEditing(null)
      showToast(t('admin.planSaved') || 'Plan updated')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error')
    } finally { setSaving(false) }
  }

  const fmt = (v) => v === -1 || v === Infinity ? (t('admin.unlimited') || 'Unlimited') : v?.toLocaleString()

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {plans.map((plan) => (
        <div key={plan.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-5 ${editing === plan.id ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
            {editing === plan.id ? (
              <div className="flex gap-1">
                <button onClick={() => handleSave(plan.id)} disabled={saving} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => handleEdit(plan)} className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300"><Edit3 className="w-4 h-4" /></button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('admin.priceMonthly') || 'Monthly Price'}</label>
              {editing === plan.id ? (
                <input type="number" value={editForm.price_monthly} onChange={(e) => setEditForm({ ...editForm, price_monthly: Number(e.target.value) })} className="w-full mt-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{plan.price_monthly} <span className="text-sm font-normal text-gray-500">EGP/mo</span></p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('admin.priceYearly') || 'Yearly Price'}</label>
              {editing === plan.id ? (
                <input type="number" value={editForm.price_yearly} onChange={(e) => setEditForm({ ...editForm, price_yearly: Number(e.target.value) })} className="w-full mt-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              ) : (
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{plan.price_yearly} <span className="text-sm font-normal text-gray-500">EGP/yr</span></p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              {[
                { label: t('admin.maxProducts') || 'Products', key: 'max_products' },
                { label: t('admin.maxUsers') || 'Users', key: 'max_users' },
                { label: t('admin.maxOrders') || 'Orders/mo', key: 'max_orders_monthly' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
                  {editing === plan.id ? (
                    <input type="number" value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{fmt(plan[key])}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityTab({ t }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await superAdminApi.getActivity({ limit: 50 })
        setActivities(data || [])
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {activities.length === 0 ? (
        <div className="p-8 text-center text-gray-400 dark:text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{t('admin.noActivity') || 'No activity recorded'}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {activities.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{a.action} {a.entity_type ? `— ${a.entity_type}` : ''}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {a.users?.username || 'System'} {a.entity_id ? `#${a.entity_id}` : ''}
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {a.created_at ? new Date(a.created_at).toLocaleString() : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
