import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useUserStore, PERMISSIONS } from '../stores/userStore'
import { servicesApi } from '../lib/api'
import { X, Plus, Edit2, Trash2, Wrench, Shield, Settings } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const SERVICE_TYPES = [
  { value: 'maintenance', icon: Wrench },
  { value: 'warranty', icon: Shield },
  { value: 'custom', icon: Settings },
]

export default function ServicesPage() {
  const { t, language } = useAppStore()
  const { hasPermission } = useUserStore()
  const canEdit = hasPermission(PERMISSIONS.SERVICES_EDIT)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchServices() }, [])

  const fetchServices = async () => {
    setLoading(true)
    try {
      const { data } = await servicesApi.getAll()
      setServices(data)
    } catch (err) {
      console.error('Failed to fetch services:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await servicesApi.delete(id)
      setDeleteTarget(null)
      fetchServices()
    } catch (err) {
      console.error('Failed to delete service:', err)
    } finally {
      setDeleting(false)
    }
  }

  const getTypeLabel = (type) => {
    const labels = {
      maintenance: t('services.typeMaintenance'),
      warranty: t('services.typeWarranty'),
      custom: t('services.typeCustom'),
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('services.title') || 'Services'}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('services.subtitle') || 'Manage your services'}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            {t('services.addService') || 'Add Service'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('common.loading') || 'Loading...'}</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <Wrench className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">{t('services.noServices') || 'No services yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(service => {
            const TypeIcon = SERVICE_TYPES.find(t => t.value === service.service_type)?.icon || Settings
            return (
              <div key={service.id} className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 shadow-sm rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <TypeIcon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {getTypeLabel(service.service_type)}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(service); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(service.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                {service.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{service.description}</p>}
                <div className="text-lg font-bold text-primary-600">{service.price?.toLocaleString()} {t('common.currency') || 'EGP'}</div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ServiceForm
          service={editing}
          onSave={async (data) => {
            if (editing) await servicesApi.update(editing.id, data)
            else await servicesApi.create(data)
            setShowForm(false)
            setEditing(null)
            fetchServices()
          }}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title={t('services.deleteService') || 'Delete Service'}
        message={t('services.deleteConfirm') || 'Are you sure you want to delete this service?'}
        type="danger"
        loading={deleting}
      />
    </div>
  )
}

function ServiceForm({ service, onSave, onClose }) {
  const { t, language } = useAppStore()
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price || '',
    service_type: service?.service_type || 'maintenance',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onSave({ ...form, price: parseFloat(form.price) || 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">{service ? t('services.editService') : t('services.addService')}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.name') || 'Name'} *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.description') || 'Description'}</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('services.price') || 'Price'} *</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('services.type') || 'Type'}</label>
              <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <option value="maintenance">{t('services.typeMaintenance') || 'Maintenance'}</option>
                <option value="warranty">{t('services.typeWarranty') || 'Warranty'}</option>
                <option value="custom">{t('services.typeCustom') || 'Custom'}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{t('common.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
