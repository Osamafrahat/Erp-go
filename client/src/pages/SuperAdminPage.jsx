import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import { superAdminApi } from '../lib/api'
import { Search, Shield, Building2, Users, Package, TrendingUp, AlertTriangle, CheckCircle, Plus, Trash2, LogIn, DollarSign, Edit3, X, Save, Eye, Activity, BarChart3, CreditCard, Database } from 'lucide-react'

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

function MiniBarChart({ data, height = 60 }) {
  const values = Object.values(data)
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {Object.entries(data).map(([day, val]) => (
        <div
          key={day}
          className="flex-1 bg-primary-400 dark:bg-primary-600 rounded-t min-w-[4px] transition-all"
          style={{ height: `${(val / max) * 100}%` }}
          title={`${day}: ${val.toLocaleString()} EGP`}
        />
      ))}
    </div>
  )
}

export default function SuperAdminPage() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const [tab, setTab] = useState('dashboard')
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

  const tabs = [
    { key: 'dashboard', label: t('admin.tabDashboard') || 'Dashboard', icon: BarChart3 },
    { key: 'tenants', label: t('admin.tabTenants') || 'Tenants', icon: Building2 },
    { key: 'payments', label: t('admin.tabPayments') || 'Payments', icon: CreditCard },
    { key: 'plans', label: t('admin.tabPlans') || 'Plans', icon: DollarSign },
    { key: 'activity', label: t('admin.tabActivity') || 'Activity', icon: Activity },
  ]

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
          {t('admin.subtitle') || 'Manage all tenants, payments, and subscriptions'}
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {tab === 'dashboard' && <DashboardTab t={t} />}
      {tab === 'tenants' && <TenantsTab t={t} showToast={showToast} />}
      {tab === 'payments' && <PaymentsTab t={t} />}
      {tab === 'plans' && <PlansTab t={t} showToast={showToast} />}
      {tab === 'activity' && <ActivityTab t={t} />}
    </div>
  )
}

function DashboardTab({ t }) {
  const [analytics, setAnalytics] = useState(null)
  const [period, setPeriod] = useState('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    superAdminApi.getAnalytics({ period }).then(({ data }) => {
      setAnalytics(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [period])

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!analytics) return null

  const fmt = (v) => `${(v || 0).toLocaleString()} ج.م`

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5">
          <option value="7d">{t('admin.period7d') || '7 Days'}</option>
          <option value="30d">{t('admin.period30d') || '30 Days'}</option>
          <option value="90d">{t('admin.period90d') || '90 Days'}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('admin.totalTenants') || 'Total Tenants', value: analytics.total_tenants, icon: Building2, color: 'text-gray-600 dark:text-gray-400' },
          { label: t('admin.estimatedMRR') || 'Est. MRR', value: fmt(analytics.estimated_mrr), icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
          { label: t('admin.totalRevenue') || 'Total Revenue', value: fmt(analytics.total_revenue), icon: DollarSign, color: 'text-primary-600 dark:text-primary-400' },
          { label: t('admin.periodRevenue') || 'Period Revenue', value: fmt(analytics.period_revenue), icon: BarChart3, color: 'text-blue-600 dark:text-blue-400' },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('admin.revenueChart') || 'Revenue Chart'}</h3>
          {Object.keys(analytics.daily_revenue || {}).length > 0 ? (
            <>
              <MiniBarChart data={analytics.daily_revenue} height={80} />
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{Object.keys(analytics.daily_revenue)[0]}</span>
                <span>{Object.keys(analytics.daily_revenue).pop()}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">{t('admin.noPayments') || 'No revenue data yet'}</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('admin.tierDistribution') || 'Tier Distribution'}</h3>
          <div className="space-y-3">
            {Object.entries(analytics.tier_distribution || {}).map(([tier, count]) => {
              const total = analytics.total_tenants || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={tier}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[tier] || tierColors.free}`}>{tier}</span>
                    <span className="text-gray-500 dark:text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className={`h-2 rounded-full ${tier === 'pro' ? 'bg-primary-500' : tier === 'enterprise' ? 'bg-yellow-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('admin.recentTenants') || 'Recent Tenants'}</h3>
          <div className="space-y-2">
            {(analytics.recent_tenants || []).map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                  <p className="text-xs text-gray-400">{new Date(tenant.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierColors[tenant.subscription_tier] || tierColors.free}`}>{tenant.subscription_tier}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('admin.successfulPayments') || 'Payments Summary'}</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('admin.totalOrders') || 'Total Payments'}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{analytics.total_payments}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('admin.successfulPayments') || 'Successful'}</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">{analytics.successful_payments}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('admin.successRate') || 'Success Rate'}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {analytics.total_payments > 0 ? Math.round((analytics.successful_payments / analytics.total_payments) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">{t('admin.migrationRequired') || 'Database Migration Required'}</h3>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">{t('admin.migrationHint') || 'Run this SQL in Supabase SQL Editor (Dashboard → SQL Editor → New Query):'}</p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
              <pre>{`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_note text;

CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paymob',
  card_last_four TEXT,
  card_brand TEXT,
  token TEXT NOT NULL,
  paymob_token_id TEXT,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fix old payment amounts stored as cents
UPDATE tenant_payments SET amount = amount / 100 WHERE amount > 1000;`}</pre>
            </div>
            <button
              onClick={() => {
                const sql = `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;\nALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_note text;\n\nCREATE TABLE IF NOT EXISTS saved_payment_methods (\n  id SERIAL PRIMARY KEY,\n  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,\n  provider TEXT NOT NULL DEFAULT 'paymob',\n  card_last_four TEXT,\n  card_brand TEXT,\n  token TEXT NOT NULL,\n  paymob_token_id TEXT,\n  is_default BOOLEAN DEFAULT true,\n  created_at TIMESTAMPTZ DEFAULT now(),\n  updated_at TIMESTAMPTZ DEFAULT now()\n);\n\n-- Fix old payment amounts stored as cents\nUPDATE tenant_payments SET amount = amount / 100 WHERE amount > 1000;`
                navigator.clipboard.writeText(sql)
              }}
              className="mt-2 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 px-3 py-1.5 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-700 font-medium"
            >
              {t('admin.copySql') || 'Copy SQL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TenantsTab({ t, showToast }) {
  const [tenants, setTenants] = useState([])
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

  const statusLabels = {
    active: t('billing.active') || 'Active',
    trialing: t('billing.trial') || 'Trial',
    cancelled: t('billing.cancelled') || 'Cancelled',
    past_due: t('billing.pastDue') || 'Past Due',
  }

  const fetchTenants = useCallback(async () => {
    try {
      const params = { page, limit }
      if (search) params.search = search
      if (filterStatus) params.status = filterStatus
      if (filterTier) params.tier = filterTier
      const { data } = await superAdminApi.getTenants(params)
      setTenants(data.tenants || [])
      setTotal(data.total || 0)
    } catch { setTenants([]) } finally { setLoading(false) }
  }, [page, search, filterStatus, filterTier])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }

  const handleChangeTier = async (tenantId, newTier) => {
    setActionLoading(tenantId)
    try {
      await superAdminApi.updateTenant(tenantId, { subscription_tier: newTier })
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscription_tier: newTier } : t))
      showToast(t('admin.tierUpdated') || 'Tier updated')
    } catch (err) { showToast(err.response?.data?.error || (t('common.error') || 'Failed'), 'error') } finally { setActionLoading(null) }
  }

  const handleSuspend = async (tenantId, currentStatus) => {
    setActionLoading(tenantId)
    try {
      const newStatus = currentStatus === 'active' ? 'cancelled' : 'active'
      await superAdminApi.updateTenant(tenantId, { subscription_status: newStatus })
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscription_status: newStatus } : t))
      showToast(t('admin.tierUpdated') || 'Updated')
    } catch (err) { showToast(err.response?.data?.error || (t('common.error') || 'Failed'), 'error') } finally { setActionLoading(null) }
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
    } catch (err) { showToast(err.response?.data?.error || (t('common.error') || 'Failed'), 'error') } finally { setActionLoading(null) }
  }

  const handleDelete = async (tenantId, tenantName) => {
    if (!window.confirm(t('admin.deleteConfirm') || `Delete "${tenantName}" and ALL its data?`)) return
    setActionLoading(tenantId)
    try {
      await superAdminApi.deleteTenant(tenantId)
      setTenants(prev => prev.filter(t => t.id !== tenantId))
      showToast(t('admin.tenantDeleted') || 'Deleted')
    } catch (err) { showToast(err.response?.data?.error || (t('common.error') || 'Failed'), 'error') } finally { setActionLoading(null) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={handleSearch} placeholder={t('admin.searchPlaceholder') || 'Search...'} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2">
              <option value="">{t('admin.allStatuses') || 'All Statuses'}</option>
              <option value="active">{t('billing.active') || 'Active'}</option>
              <option value="trialing">{t('billing.trial') || 'Trial'}</option>
              <option value="cancelled">{t('billing.cancelled') || 'Cancelled'}</option>
            </select>
            <select value={filterTier} onChange={(e) => { setFilterTier(e.target.value); setPage(1) }} className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2">
              <option value="">{t('admin.allTiers') || 'All Tiers'}</option>
              <option value="free">{t('pricing.free') || 'Free'}</option>
              <option value="pro">{t('pricing.pro') || 'Pro'}</option>
              <option value="enterprise">{t('pricing.enterprise') || 'Enterprise'}</option>
            </select>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> {t('admin.createNew') || 'Create'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 font-medium">{t('common.name') || 'Name'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.tier') || 'Tier'}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status') || 'Status'}</th>
                  <th className="px-4 py-3 font-medium">{t('common.users') || 'Users'}</th>
                  <th className="px-4 py-3 font-medium">{t('common.products') || 'Products'}</th>
                  <th className="px-4 py-3 font-medium">{t('common.orders') || 'Orders'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.created') || 'Created'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.expires') || 'Expires'}</th>
                  <th className="px-4 py-3 font-medium">{t('common.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3"><p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p><p className="text-xs text-gray-400">{tenant.slug}</p></td>
                    <td className="px-4 py-3">
                      <select value={tenant.subscription_tier} onChange={(e) => handleChangeTier(tenant.id, e.target.value)} disabled={actionLoading === tenant.id} className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${tierColors[tenant.subscription_tier] || tierColors.free}`}>
                        <option value="free">{t('pricing.free') || 'Free'}</option><option value="pro">{t('pricing.pro') || 'Pro'}</option><option value="enterprise">{t('pricing.enterprise') || 'Enterprise'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[tenant.subscription_status] || statusColors.cancelled}`}>{statusLabels[tenant.subscription_status] || tenant.subscription_status}</span></td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300"><Users className="w-3.5 h-3.5 inline mr-1" />{tenant.user_count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300"><Package className="w-3.5 h-3.5 inline mr-1" />{tenant.product_count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{tenant.order_count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {tenant.subscription_expires_at ? (
                        <span className={`text-xs font-medium ${new Date(tenant.subscription_expires_at) < new Date() ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {new Date(tenant.subscription_expires_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setDetailTenant(tenant)} className="text-xs p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleImpersonate(tenant.id)} disabled={actionLoading === tenant.id || tenant.subscription_status === 'cancelled'} className="text-xs p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 disabled:opacity-50"><LogIn className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleSuspend(tenant.id, tenant.subscription_status)} disabled={actionLoading === tenant.id} className={`text-xs p-1.5 rounded-lg ${tenant.subscription_status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'} disabled:opacity-50`}>
                          {tenant.subscription_status === 'active' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleDelete(tenant.id, tenant.name)} disabled={actionLoading === tenant.id} className="text-xs p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{t('admin.noTenants') || 'No tenants found'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-500">{t('admin.showing') || 'Showing'} {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} {t('admin.of') || 'of'} {total}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300">{t('common.previous') || 'Prev'}</button>
              <span className="px-3 py-1 text-gray-500">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300">{t('common.next') || 'Next'}</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateTenantModal t={t} showToast={showToast} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchTenants() }} />}
      {detailTenant && <TenantDetailModal t={t} tenantId={detailTenant.id} onClose={() => setDetailTenant(null)} />}
    </>
  )
}

function CreateTenantModal({ t, showToast, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', adminUsername: '', adminPassword: '', adminEmail: '', adminFullName: '', tier: 'free' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await superAdminApi.createTenant(form); showToast(t('admin.tenantCreated') || 'Created'); onCreated() }
    catch (err) { setError(err.response?.data?.error || (t('common.error') || 'Failed')) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.createNew') || 'Create Tenant'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('admin.storeName') || 'Store Name'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} placeholder={t('admin.adminFullName') || 'Admin Full Name'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} placeholder={t('admin.adminUsername') || 'Admin Username'} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder={t('admin.adminEmail') || 'Admin Email'} type="email" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
          <input value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder={t('admin.adminPassword') || 'Admin Password'} type="password" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required minLength={8} />
          <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="free">{t('pricing.free') || 'Free'}</option><option value="pro">{t('pricing.pro') || 'Pro'}</option><option value="enterprise">{t('pricing.enterprise') || 'Enterprise'}</option>
          </select>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{t('common.cancel') || 'Cancel'}</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{loading ? '...' : (t('common.add') || 'Create')}</button>
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
    superAdminApi.getTenant(tenantId).then(({ data }) => setTenant(data)).catch(() => {}).finally(() => setLoading(false))
  }, [tenantId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.details') || 'Tenant Details'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {loading ? <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        : tenant ? (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[{ label: t('common.users') || 'Users', value: tenant.user_count }, { label: t('common.products') || 'Products', value: tenant.product_count }, { label: t('common.orders') || 'Orders', value: tenant.order_count }, { label: t('admin.tier') || 'Tier', value: tenant.subscription_tier }].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            {tenant.users?.length > 0 && (
              <div><h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.users') || 'Users'}</h3>
                <div className="space-y-1">{tenant.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div><span className="font-medium text-gray-900 dark:text-white">{u.username}</span><span className="text-gray-400 ml-2">{u.role}</span></div>
                    <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-600'}`}>{u.is_active ? (t('common.active') || 'Active') : (t('common.inactive') || 'Inactive')}</span>
                  </div>
                ))}</div>
              </div>
            )}
            {tenant.recent_orders?.length > 0 && (
              <div><h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.recentOrders') || 'Recent Orders'}</h3>
                <div className="space-y-1">{tenant.recent_orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-gray-900 dark:text-white">{o.order_number}</span><span className="text-gray-500">{o.total_amount} ج.م</span>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PaymentsTab({ t }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    superAdminApi.getPayments({ limit: 50, status: 'paid' }).then(({ data }) => {
      setPayments(data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">{t('billing.paymentHistory') || 'Payment History'}</h3>
      </div>
      {payments.length === 0 ? (
        <div className="p-8 text-center text-gray-400"><CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>{t('admin.noPayments') || 'No payments recorded'}</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">{t('admin.tenant') || 'Tenant'}</th>
                <th className="px-4 py-3 font-medium">{t('common.amount') || 'Amount'}</th>
                <th className="px-4 py-3 font-medium">{t('common.status') || 'Status'}</th>
                <th className="px-4 py-3 font-medium">{t('common.date') || 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="px-4 py-3"><p className="text-gray-900 dark:text-white">{p.tenant?.name || (t('admin.unknown') || 'Unknown')}</p><p className="text-xs text-gray-400">{p.tenant?.subscription_tier || ''}</p></td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{(p.amount || 0).toLocaleString()} ج.م</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${p.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : p.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    superAdminApi.getPlans().then(({ data }) => setPlans(data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleEdit = (plan) => {
    setEditing(plan.id)
    setEditForm({ price_monthly: plan.price_monthly, price_yearly: plan.price_yearly, max_products: plan.max_products, max_users: plan.max_users, max_orders_monthly: plan.max_orders_monthly })
  }

  const handleSave = async (planId) => {
    setSaving(true)
    try {
      const { data } = await superAdminApi.updatePlan(planId, editForm)
      setPlans(prev => prev.map(p => p.id === planId ? data : p))
      setEditing(null)
      showToast(t('admin.planSaved') || 'Plan updated')
    } catch (err) { showToast(err.response?.data?.error || (t('common.error') || 'Failed'), 'error') } finally { setSaving(false) }
  }

  const fmt = (v) => v === -1 || v === Infinity ? '∞' : v?.toLocaleString()

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {plans.map((plan) => (
        <div key={plan.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-5 ${editing === plan.id ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
            {editing === plan.id ? (
              <div className="flex gap-1">
                <button onClick={() => handleSave(plan.id)} disabled={saving} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
              </div>
            ) : <button onClick={() => handleEdit(plan)} className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300"><Edit3 className="w-4 h-4" /></button>}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">{t('admin.monthlyPrice') || 'Monthly Price'} (ج.م)</label>
              {editing === plan.id ? <input type="number" value={editForm.price_monthly} onChange={(e) => setEditForm({ ...editForm, price_monthly: Number(e.target.value) })} className="w-full mt-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              : <p className="text-2xl font-bold text-gray-900 dark:text-white">{plan.price_monthly?.toLocaleString()} <span className="text-sm font-normal text-gray-500">ج.م/{t('pricing.perMonth') || 'mo'}</span></p>}
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('admin.yearlyPrice') || 'Yearly Price'} (ج.م)</label>
              {editing === plan.id ? <input type="number" value={editForm.price_yearly} onChange={(e) => setEditForm({ ...editForm, price_yearly: Number(e.target.value) })} className="w-full mt-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              : <p className="text-lg font-semibold text-gray-900 dark:text-white">{plan.price_yearly?.toLocaleString()} <span className="text-sm font-normal text-gray-500">ج.م/{t('pricing.perYear') || 'yr'}</span></p>}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              {[{ label: t('common.products') || 'Products', key: 'max_products' }, { label: t('common.users') || 'Users', key: 'max_users' }, { label: t('admin.ordersPerMonth') || 'Orders/mo', key: 'max_orders_monthly' }].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500">{label}</label>
                  {editing === plan.id ? <input type="number" value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                  : <p className="text-sm font-medium text-gray-900 dark:text-white">{fmt(plan[key])}</p>}
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
    superAdminApi.getActivity({ limit: 50 }).then(({ data }) => setActivities(data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {activities.length === 0 ? (
        <div className="p-8 text-center text-gray-400"><Activity className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>{t('admin.noActivity') || 'No activity recorded'}</p></div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {activities.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{a.action} {a.entity_type ? `— ${a.entity_type}` : ''}</p>
                <p className="text-xs text-gray-400">{a.users?.username || 'System'} {a.entity_id ? `#${a.entity_id}` : ''}</p>
              </div>
              <span className="text-xs text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
