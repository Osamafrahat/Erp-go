import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUserStore, ROLES, PERMISSIONS } from '../stores/userStore'
import { useAppStore } from '../stores/appStore'
import { usersApi, employeesApi } from '../lib/api'
import { X, Plus, Edit2, Trash2, User, UserCheck, Shield } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const permissionLabelsEn = {
  [PERMISSIONS.DASHBOARD_VIEW]: 'View Dashboard',
  [PERMISSIONS.POS_ACCESS]: 'POS Access',
  [PERMISSIONS.INVENTORY_VIEW]: 'View Inventory',
  [PERMISSIONS.INVENTORY_EDIT]: 'Edit Inventory',
  [PERMISSIONS.REPORTS_VIEW]: 'View Reports',
  [PERMISSIONS.SUPPLIERS_VIEW]: 'View Suppliers',
  [PERMISSIONS.SUPPLIERS_EDIT]: 'Edit Suppliers',
  [PERMISSIONS.PROMOTIONS_VIEW]: 'View Promotions',
  [PERMISSIONS.PROMOTIONS_EDIT]: 'Edit Promotions',
  [PERMISSIONS.SETTINGS_VIEW]: 'View Settings',
  [PERMISSIONS.SETTINGS_EDIT]: 'Edit Settings',
  [PERMISSIONS.USER_MANAGE]: 'Manage Users',
  [PERMISSIONS.CUSTOMERS_VIEW]: 'View Customers',
  [PERMISSIONS.CUSTOMERS_EDIT]: 'Edit Customers',
  [PERMISSIONS.EXPENSES_VIEW]: 'View Expenses',
  [PERMISSIONS.EXPENSES_EDIT]: 'Manage Expenses',
  [PERMISSIONS.REFUNDS_VIEW]: 'View Refunds',
  [PERMISSIONS.REFUNDS_EDIT]: 'Process Refunds',
  [PERMISSIONS.EMPLOYEES_VIEW]: 'View Employees',
  [PERMISSIONS.EMPLOYEES_EDIT]: 'Manage Employees',
  [PERMISSIONS.ACCOUNTING_VIEW]: 'View Accounting',
  [PERMISSIONS.ACCOUNTING_EDIT]: 'Edit Accounting',
  [PERMISSIONS.ACCOUNTING_POST]: 'Post Journal Entries',
  [PERMISSIONS.HR_VIEW]: 'View HR',
  [PERMISSIONS.HR_EDIT]: 'Edit HR',
}

const permissionLabelsAr = {
  [PERMISSIONS.DASHBOARD_VIEW]: 'عرض لوحة التحكم',
  [PERMISSIONS.POS_ACCESS]: 'الوصول لنقطة البيع',
  [PERMISSIONS.INVENTORY_VIEW]: 'عرض المخزون',
  [PERMISSIONS.INVENTORY_EDIT]: 'تعديل المخزون',
  [PERMISSIONS.REPORTS_VIEW]: 'عرض التقارير',
  [PERMISSIONS.SUPPLIERS_VIEW]: 'عرض الموردين',
  [PERMISSIONS.SUPPLIERS_EDIT]: 'تعديل الموردين',
  [PERMISSIONS.PROMOTIONS_VIEW]: 'عرض العروض',
  [PERMISSIONS.PROMOTIONS_EDIT]: 'تعديل العروض',
  [PERMISSIONS.SETTINGS_VIEW]: 'عرض الإعدادات',
  [PERMISSIONS.SETTINGS_EDIT]: 'تعديل الإعدادات',
  [PERMISSIONS.USER_MANAGE]: 'إدارة المستخدمين',
  [PERMISSIONS.CUSTOMERS_VIEW]: 'عرض العملاء',
  [PERMISSIONS.CUSTOMERS_EDIT]: 'تعديل العملاء',
  [PERMISSIONS.EXPENSES_VIEW]: 'عرض المصروفات',
  [PERMISSIONS.EXPENSES_EDIT]: 'إدارة المصروفات',
  [PERMISSIONS.REFUNDS_VIEW]: 'عرض المرتجعات',
  [PERMISSIONS.REFUNDS_EDIT]: 'معالجة المرتجعات',
  [PERMISSIONS.EMPLOYEES_VIEW]: 'عرض الموظفين',
  [PERMISSIONS.EMPLOYEES_EDIT]: 'إدارة الموظفين',
  [PERMISSIONS.ACCOUNTING_VIEW]: 'عرض المحاسبة',
  [PERMISSIONS.ACCOUNTING_EDIT]: 'تعديل المحاسبة',
  [PERMISSIONS.ACCOUNTING_POST]: 'تدوين القيود المحاسبية',
  [PERMISSIONS.HR_VIEW]: 'عرض الموارد البشرية',
  [PERMISSIONS.HR_EDIT]: 'تعديل الموارد البشرية',
}

export default function UsersPage() {
  const { users, currentUser, addUser, updateUser, deleteUser, toggleUserActive, hasPermission } = useUserStore()
  const canManage = hasPermission(PERMISSIONS.USER_MANAGE)
  const { t, language } = useAppStore()
  const permissionLabels = language === 'ar' ? permissionLabelsAr : permissionLabelsEn
  const location = useLocation()
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [employees, setEmployees] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadUsers = async () => {
    try {
      const { data } = await usersApi.getAll()
      const mapped = data.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        role: u.role,
        permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || []),
        isActive: u.is_active,
        mustChangePassword: u.must_change_password,
        lastLogin: u.last_login,
        employeeId: u.employee_id,
        employee: u.employee || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }))
      useUserStore.setState({ users: mapped })
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  useEffect(() => {
    loadUsers()
    fetchEmployees()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadUsers()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [location.pathname])

  const fetchEmployees = async () => {
    try {
      const response = await employeesApi.getAll()
      setEmployees(response.data || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  // Only managers can access this page
  if (currentUser?.role !== 'MANAGER') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('users.accessDenied')}</h2>
          <p className="text-gray-500 dark:text-gray-400">{t('users.managerOnly')}</p>
        </div>
      </div>
    )
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setShowForm(true)
  }

  const handleDelete = async (userId) => {
    setDeleting(true)
    try {
      const result = await deleteUser(userId)
      if (!result.success) {
        alert(result.error)
      }
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (userId) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await toggleUserActive(userId)
      loadUsers()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('users.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('users.subtitle')}</p>
        </div>
        {canManage && (
        <button
          onClick={() => {
            setEditingUser(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          {t('users.addUser')}
        </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-start p-4 font-medium text-gray-500 dark:text-gray-400">{t('users.fullName')}</th>
                <th className="text-start p-4 font-medium text-gray-500 dark:text-gray-400">{t('users.role')}</th>
                <th className="text-start p-4 font-medium text-gray-500 dark:text-gray-400">{t('users.employee')}</th>
                <th className="text-start p-4 font-medium text-gray-500 dark:text-gray-400">{t('users.status')}</th>
                <th className="text-end p-4 font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {user.id === 1 ? (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        {t('users.adminProtected')}
                      </span>
                    ) : (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'MANAGER'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : user.role === 'SALES_MANAGER'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                          : user.role === 'CASHIER'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : user.role === 'INVENTORY_CLERK'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : user.role === 'ACCOUNTANT'
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                          : user.role === 'HR_MANAGER'
                          ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {ROLES[user.role]?.name || user.role}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {user.employee ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <UserCheck className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-sm">{user.employee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleActive(user.id)}
                      disabled={user.id === 1 || user.id === currentUser?.id}
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      } ${(user.id === 1 || user.id === currentUser?.id) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      {user.isActive ? t('users.active') : t('users.inactive')}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {user.id !== 1 && canManage && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {user.id !== 1 && user.id !== currentUser?.id && canManage && (
                        <button
                          onClick={() => setDeleteTarget(user.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <UserForm
          user={editingUser}
          employees={employees}
          onSave={async (userData) => {
            if (isSubmitting) return
            setIsSubmitting(true)
            try {
              let result
              if (editingUser) {
                result = await updateUser(editingUser.id, userData)
              } else {
                result = await addUser(userData)
              }
              if (result?.success !== false) {
                setShowForm(false)
                setEditingUser(null)
                loadUsers()
              }
            } finally {
              setIsSubmitting(false)
            }
          }}
          onClose={() => {
            setShowForm(false)
            setEditingUser(null)
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('users.deleteUser') || 'Delete User'}
        message={t('users.deleteConfirm') || 'Are you sure you want to delete this user?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}

function UserForm({ user, employees, onSave, onClose }) {
  const { t, language } = useAppStore()
  const permissionLabels = language === 'ar' ? permissionLabelsAr : permissionLabelsEn
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    fullName: user?.fullName || '',
    role: user?.role || 'CASHIER',
    permissions: user?.permissions || ROLES.CASHIER.permissions,
    employeeId: user?.employee_id || '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Update permissions when role changes
    if (name === 'role') {
      setFormData(prev => ({
        ...prev,
        role: value,
        permissions: ROLES[value]?.permissions || [],
      }))
    }
  }

  const handlePermissionToggle = (permission) => {
    setFormData(prev => {
      const hasPermission = prev.permissions.includes(permission)
      return {
        ...prev,
        permissions: hasPermission
          ? prev.permissions.filter(p => p !== permission)
          : [...prev.permissions, permission],
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user && !formData.password) {
      alert(t('users.passwordRequired'))
      return
    }
    await onSave({
      ...formData,
      password: formData.password || undefined,
      employeeId: formData.employeeId || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {user ? t('users.editUser') : t('users.addNewUser')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.fullName')} *
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              placeholder={t('users.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.username')} *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              placeholder={t('users.usernamePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.password')} {user ? `(${t('users.passwordHint')})` : '*'}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.role')} *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {Object.entries(ROLES).map(([key, role]) => (
                <option key={key} value={key}>{language === 'ar' ? role.nameAr : role.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.employee')}
            </label>
            <select
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <option value="">{t('users.noEmployee')}</option>
              {employees.filter(e => e.is_active).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} - {emp.role}</option>
              ))}
            </select>
          </div>

          {/* Custom Permissions */}
          {user && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg">
              <span className="text-yellow-600 dark:text-yellow-400 text-sm">
                {language === 'ar' ? 'تغيير الصلاحيات سيجبر المستخدم على تسجيل الخروج' : 'Changing permissions will force the user to re-login'}
              </span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('users.permissions')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-48 overflow-auto">
              {Object.entries(permissionLabels).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(key)}
                    onChange={() => handlePermissionToggle(key)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {user ? t('common.save') : t('users.addUser')}
          </button>
        </div>
      </div>
    </div>
  )
}
