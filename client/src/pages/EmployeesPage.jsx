import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore, PERMISSIONS } from '../stores/userStore'
import { employeesApi, usersApi } from '../lib/api'
import { X, Plus, Edit2, Trash2, UserCheck, User, Phone, Mail, Calendar, DollarSign, Shield } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const USER_ROLES = (t) => [
  { value: 'MANAGER', label: t('role.manager') },
  { value: 'SALES_MANAGER', label: t('role.salesManager') || 'Sales Manager' },
  { value: 'CASHIER', label: t('role.cashier') },
  { value: 'INVENTORY_CLERK', label: t('role.inventoryClerk') },
  { value: 'ACCOUNTANT', label: t('role.accountant') || 'Accountant' },
  { value: 'HR_MANAGER', label: t('role.hrManager') || 'HR Manager' },
]

export default function EmployeesPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const { currentUser, hasPermission } = useUserStore()
  const canEdit = hasPermission(PERMISSIONS.EMPLOYEES_EDIT)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const response = await employeesApi.getAll()
      setEmployees(response.data)
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setShowForm(true)
  }

  const refreshUsers = async () => {
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
      console.error('Failed to refresh users:', err)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await employeesApi.delete(id)
      toastSuccess(t('employees.deleted') || 'Employee deleted successfully')
      await fetchEmployees()
      await refreshUsers()
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete employee:', err)
      toastError(t('employees.failedToDelete') || 'Failed to delete employee')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (id) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await employeesApi.toggleActive(id)
      await fetchEmployees()
      await refreshUsers()
    } catch (err) {
      console.error('Failed to toggle employee status:', err)
      toastError(t('employees.failedToToggle') || 'Failed to toggle employee status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSave = async (employeeData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editingEmployee) {
        await employeesApi.update(editingEmployee.id, employeeData)
        toastSuccess(t('employees.updated') || 'Employee updated successfully')
      } else {
        await employeesApi.create(employeeData)
        toastSuccess(t('employees.created') || 'Employee added successfully')
      }
      setShowForm(false)
      setEditingEmployee(null)
      fetchEmployees()
    } catch (err) {
      console.error('Failed to save employee:', err)
      toastError(t('employees.failedToSave') || 'Failed to save employee')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRoleColor = (role) => {
    const colors = {
      MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      SALES_MANAGER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      CASHIER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      INVENTORY_CLERK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      ACCOUNTANT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      HR_MANAGER: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    }
    return colors[role] || colors.CASHIER
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('employees.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('employees.subtitle')}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingEmployee(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            {t('employees.addEmployee')}
          </button>
        )}
      </div>

      {/* Employees Grid */}
      {employees.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <UserCheck className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('employees.noEmployees')}</h3>
          <p className="text-gray-500 dark:text-gray-400">{t('employees.addFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <UserCheck className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{employee.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(employee.role)}`}>
                      {USER_ROLES(t).find(r => r.value === employee.role)?.label || employee.role}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button
                      onClick={() => handleEdit(employee)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => setDeleteTarget(employee.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {employee.phone && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.email && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{employee.email}</span>
                  </div>
                )}
                {employee.hire_date && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{t('employees.hired')} {new Date(employee.hire_date).toLocaleDateString()}</span>
                  </div>
                )}
                {employee.salary > 0 && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <DollarSign className="w-4 h-4" />
                    <span>{t('employees.salaryLabel')} {employee.salary?.toLocaleString()} {t('common.currency') || 'EGP'}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleToggleActive(employee.id)}
                    className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-colors ${
                      employee.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                    }`}
                  >
                    {employee.is_active ? t('employees.active') : t('employees.inactive')}
                  </button>
                  {employee.user && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {employee.user.username}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Employee Form Modal */}
      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false)
            setEditingEmployee(null)
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('employees.deleteEmployee') || 'Delete Employee'}
        message={t('employees.deleteConfirm') || 'Are you sure you want to delete this employee?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}

function EmployeeForm({ employee, onSave, onClose }) {
  const { t } = useAppStore()
  const [formData, setFormData] = useState({
    name: employee?.name || '',
    role: employee?.user?.role || employee?.role || 'CASHIER',
    phone: employee?.phone || '',
    email: employee?.email || '',
    salary: employee?.salary || '',
    hire_date: employee?.hire_date || '',
    notes: employee?.notes || '',
    create_user: !employee,
    username: employee?.user?.username || '',
    password: '',
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      name: formData.name,
      role: formData.role,
      phone: formData.phone || null,
      email: formData.email || null,
      salary: formData.salary ? parseFloat(formData.salary) : 0,
      hire_date: formData.hire_date || null,
      notes: formData.notes || null,
    }
    if (!employee && formData.create_user && formData.username) {
      payload.create_user = true
      payload.username = formData.username
      payload.password = formData.password || 'changeme123'
      payload.user_role = formData.role
    }
    onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {employee ? t('employees.editEmployee') : t('employees.addEmployee')}
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('employees.name')} *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('employees.role')} *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {USER_ROLES(t).map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            {!employee && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t('employees.roleHint') || 'This role determines the user login permissions.'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('employees.phone')}
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('employees.email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('employees.salary')}
              </label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('employees.hireDate')}
              </label>
              <input
                type="date"
                name="hire_date"
                value={formData.hire_date}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('employees.notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>

          {/* User Account Section */}
          {!employee && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('employees.userAccount') || 'Create User Account'}
                </span>
              </div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="create_user"
                  checked={formData.create_user}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('employees.createUser') || 'Create login account for this employee'}
                </span>
              </label>
              {formData.create_user && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {t('employees.username')} *
                      </label>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        required={formData.create_user}
                        placeholder={t('employees.usernamePlaceholder') || 'e.g. john_doe'}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {t('employees.password')} *
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required={formData.create_user}
                        placeholder={t('employees.passwordPlaceholder') || 'Min 6 characters'}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {t('employees.userRoleHint') || 'The user role and permissions will match the employee role selected above.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {employee ? t('common.edit') : t('common.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
