import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore, PERMISSIONS } from '../stores/userStore'
import { customersApi } from '../lib/api'
import { X, Plus, Edit2, Trash2, User, Phone, Mail, MapPin, Star } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function CustomersPage() {
  const { t, toastSuccess, toastError } = useAppStore()
  const { currentUser, hasPermission } = useUserStore()
  const canEdit = hasPermission(PERMISSIONS.CUSTOMERS_EDIT)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const response = await customersApi.getAll({ search: searchQuery })
      setCustomers(response.data)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchCustomers()
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await customersApi.delete(id)
      toastSuccess(t('customers.deleted') || 'Customer deleted successfully')
      fetchCustomers()
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete customer:', err)
      toastError(t('customers.failedToDelete') || 'Failed to delete customer')
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async (customerData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, customerData)
        toastSuccess(t('customers.updated') || 'Customer updated successfully')
      } else {
        await customersApi.create(customerData)
        toastSuccess(t('customers.created') || 'Customer added successfully')
      }
      setShowForm(false)
      setEditingCustomer(null)
      fetchCustomers()
    } catch (err) {
      console.error('Failed to save customer:', err)
      const errorMsg = err.response?.data?.error || t('customers.failedToSave') || 'Failed to save customer'
      toastError(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
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
          <h1 className="text-2xl font-bold">{t('customers.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('customers.subtitle')}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingCustomer(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            {t('customers.addCustomer')}
          </button>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder={t('customers.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {t('common.search')}
        </button>
      </form>

      {/* Customers Grid */}
      {customers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <User className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('customers.noCustomers')}</h3>
          <p className="text-gray-500 dark:text-gray-400">{t('customers.addFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{customer.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('customers.since')} {new Date(customer.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <button
                      onClick={() => handleEdit(customer)}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => setDeleteTarget(customer.id)}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span className="line-clamp-1">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-yellow-600">
                  <Star className="w-4 h-4" />
                  <span>{customer.loyalty_points || 0} {t('customers.points')}</span>
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  {t('customers.totalLabel')} ${customer.total_spent?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Form Modal */}
      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false)
            setEditingCustomer(null)
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('customers.deleteCustomer') || 'Delete Customer'}
        message={t('customers.deleteConfirm') || 'Are you sure you want to delete this customer?'}
        type="danger"
        confirmText={t('common.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        loading={deleting}
      />
    </div>
  )
}

function CustomerForm({ customer, onSave, onClose }) {
  const { t } = useAppStore()

  const parsePhone = (phone) => {
    if (!phone) return { countryCode: '+20', number: '' }
    const codes = ['+20','+966','+971','+965','+973','+974','+968','+962','+961','+216','+212','+213','+1','+44']
    for (const code of codes) {
      if (phone.startsWith(code)) {
        return { countryCode: code, number: phone.slice(code.length).replace(/^0+/, '') }
      }
    }
    return { countryCode: '+20', number: phone.replace(/^0+/, '') }
  }

  const parsed = parsePhone(customer?.phone)

  const [formData, setFormData] = useState({
    name: customer?.name || '',
    countryCode: parsed.countryCode,
    phone: parsed.number,
    email: customer?.email || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
  })
  const [phoneError, setPhoneError] = useState('')

  const countryCodes = [
    { code: '+20', name: t('country.egypt'), flag: '🇪🇬' },
    { code: '+966', name: t('country.saudiArabia'), flag: '🇸🇦' },
    { code: '+971', name: t('country.uae'), flag: '🇦🇪' },
    { code: '+965', name: t('country.kuwait'), flag: '🇰🇼' },
    { code: '+973', name: t('country.bahrain'), flag: '🇧🇭' },
    { code: '+974', name: t('country.qatar'), flag: '🇶🇦' },
    { code: '+968', name: t('country.oman'), flag: '🇴🇲' },
    { code: '+962', name: t('country.jordan'), flag: '🇯🇴' },
    { code: '+961', name: t('country.lebanon'), flag: '🇱🇧' },
    { code: '+216', name: t('country.tunisia'), flag: '🇹🇳' },
    { code: '+212', name: t('country.morocco'), flag: '🇲🇦' },
    { code: '+213', name: t('country.algeria'), flag: '🇩🇿' },
    { code: '+1', name: t('country.usaCanada'), flag: '🇺🇸' },
    { code: '+44', name: t('country.uk'), flag: '🇬🇧' },
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11) }))
      setPhoneError('')
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.phone && formData.phone.length !== 10) {
      setPhoneError(t('customers.phoneLengthError'))
      return
    }
    setPhoneError('')
    const fullPhone = formData.phone ? `${formData.countryCode}${formData.phone}` : ''
    onSave({ ...formData, phone: fullPhone })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {customer ? t('customers.editCustomer') : t('customers.addCustomer')}
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('customers.name')} *
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
              {t('customers.phone')}
            </label>
            <div className="flex gap-2">
              <select
                name="countryCode"
                value={formData.countryCode}
                onChange={handleChange}
                className="w-32 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              >
                {countryCodes.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="1xxxxxxxxx"
                inputMode="numeric"
                maxLength={10}
                className={`flex-1 px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 ${
                  phoneError ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
              />
            </div>
            {phoneError && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">{phoneError}</p>
            )}
            {!phoneError && formData.phone && formData.phone.length < 10 && (
              <p className="mt-1 text-xs text-amber-500 dark:text-amber-400">{10 - formData.phone.length} {t('customers.digitsRemaining')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('customers.email')}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('customers.address')}
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('customers.notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 min-h-[44px]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 min-h-[44px]"
            >
              {customer ? t('common.edit') : t('common.add')} {t('customers.name')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
