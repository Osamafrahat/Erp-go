import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore } from '../stores/userStore'
import api from '../lib/api'
import { Search, Shield, Building2, Users, Package, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

const tierColors = {
  free: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  pro: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  enterprise: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

export default function SuperAdminPage() {
  const { t } = useAppStore()
  const { currentUser } = useUserStore()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const { data } = await api.get('/admin/tenants')
      setTenants(data || [])
    } catch {
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  const handleSuspend = async (tenantId, isActive) => {
    setActionLoading(tenantId)
    try {
      await api.patch(`/admin/tenants/${tenantId}/${isActive ? 'suspend' : 'activate'}`)
      setTenants(prev =>
        prev.map(t => t.id === tenantId ? { ...t, status: isActive ? 'suspended' : 'active' } : t)
      )
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangeTier = async (tenantId, newTier) => {
    setActionLoading(tenantId)
    try {
      await api.patch(`/admin/tenants/${tenantId}/tier`, { tier: newTier })
      setTenants(prev =>
        prev.map(t => t.id === tenantId ? { ...t, tier: newTier } : t)
      )
    } catch (err) {
      console.error('Tier change failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Shield className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">{t('admin.accessDenied') || 'Access Denied'}</p>
        <p className="text-sm">{t('admin.roleRequired') || 'Super Admin role required'}</p>
      </div>
    )
  }

  const filtered = tenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.slug?.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    trial: tenants.filter(t => t.status === 'trialing').length,
    revenue: tenants.reduce((sum, t) => sum + (t.tier === 'pro' ? 29 : t.tier === 'enterprise' ? 99 : 0), 0),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6" />
          {t('admin.title') || 'Super Admin Panel'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('admin.subtitle') || 'Manage all tenants and subscriptions'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('admin.totalTenants') || 'Total Tenants', value: stats.total, icon: Building2, color: 'text-gray-600 dark:text-gray-400' },
          { label: t('admin.active') || 'Active', value: stats.active, icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
          { label: t('admin.trial') || 'Trial', value: stats.trial, icon: AlertTriangle, color: 'text-blue-600 dark:text-blue-400' },
          { label: t('admin.mrr') || 'MRR', value: `$${stats.revenue}`, icon: TrendingUp, color: 'text-primary-600 dark:text-primary-400' },
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
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchPlaceholder') || 'Search tenants...'}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">{t('admin.colName') || 'Name'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.colTier') || 'Tier'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.colStatus') || 'Status'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.colUsers') || 'Users'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.colProducts') || 'Products'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.colCreated') || 'Created'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.colActions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{tenant.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={tenant.tier}
                      onChange={(e) => handleChangeTier(tenant.id, e.target.value)}
                      disabled={actionLoading === tenant.id}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${tierColors[tenant.tier] || tierColors.free}`}
                    >
                      <option value="free">{t('admin.free') || 'Free'}</option>
                      <option value="pro">{t('admin.pro') || 'Pro'}</option>
                      <option value="enterprise">{t('admin.enterprise') || 'Enterprise'}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      tenant.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : tenant.status === 'trialing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    {tenant.users_count ?? tenant.usersCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <Package className="w-3.5 h-3.5 inline mr-1" />
                    {tenant.products_count ?? tenant.productsCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSuspend(tenant.id, tenant.status === 'active')}
                      disabled={actionLoading === tenant.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        tenant.status === 'active'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                      } disabled:opacity-50`}
                    >
                      {actionLoading === tenant.id ? '...' : tenant.status === 'active' ? (t('admin.suspend') || 'Suspend') : (t('admin.activate') || 'Activate')}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    {t('admin.noTenants') || 'No tenants found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
