import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import api from '../lib/api'
import ConfirmModal from '../components/ConfirmModal'
import {
  Download,
  Upload,
  Trash2,
  Database,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Zap,
  ZapOff,
  Calendar,
  DownloadCloud,
  Cloud,
  CloudOff,
} from 'lucide-react'

export default function BackupPage() {
  const { t } = useAppStore()
  const [backups, setBackups] = useState([])
  const [cloudBackups, setCloudBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(null)
  const [restoring, setRestoring] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [message, setMessage] = useState(null)
  const [autoStatus, setAutoStatus] = useState(null)
  const [togglingAuto, setTogglingAuto] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [uploadingCloud, setUploadingCloud] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [deletingCloud, setDeletingCloud] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', type: 'danger', onConfirm: null })

  const loadBackups = async () => {
    try {
      setLoading(true)
      const res = await api.get('/backup')
      setBackups(res.data)
    } catch (err) {
      setMessage({ type: 'error', text: t('backup.loadFailed') })
    } finally {
      setLoading(false)
    }
  }

  const loadCloudBackups = async () => {
    try {
      setCloudLoading(true)
      const res = await api.get('/backup/cloud')
      setCloudBackups(res.data)
    } catch {
      setCloudBackups([])
    } finally {
      setCloudLoading(false)
    }
  }

  const loadAutoStatus = async () => {
    try {
      const res = await api.get('/backup/auto-status')
      setAutoStatus(res.data)
    } catch {}
  }

  useEffect(() => { loadBackups(); loadAutoStatus(); loadCloudBackups() }, [])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const createBackup = async (format) => {
    try {
      setCreating(format)
      const res = await api.post(`/backup/${format}`)
      showMessage('success', t('backup.created').replace('{rows}', res.data.totalRows))
      loadBackups()
    } catch (err) {
      showMessage('error', t('backup.createFailed'))
    } finally {
      setCreating(null)
    }
  }

  const toggleAutoBackup = async () => {
    try {
      setTogglingAuto(true)
      if (autoStatus?.enabled) {
        const res = await api.post('/backup/auto-disable')
        setAutoStatus(res.data)
        showMessage('success', t('backup.autoDisabledMsg'))
      } else {
        const res = await api.post('/backup/auto-enable')
        setAutoStatus(res.data)
        showMessage('success', t('backup.autoEnabled'))
      }
    } catch (err) {
      showMessage('error', t('backup.autoToggleFailed'))
    } finally {
      setTogglingAuto(false)
    }
  }

  const downloadBackup = async (filename) => {
    try {
      const res = await api.get(`/backup/download/${filename}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showMessage('error', t('backup.downloadFailed'))
    }
  }

  const downloadAllBackups = async () => {
    try {
      setDownloadingAll(true)
      for (const backup of backups) {
        await downloadBackup(backup.name)
        await new Promise(r => setTimeout(r, 500))
      }
      showMessage('success', t('backup.downloadAllDone').replace('{count}', backups.length))
    } catch (err) {
      showMessage('error', t('backup.downloadFailed'))
    } finally {
      setDownloadingAll(false)
    }
  }

  const restoreBackup = async (filename) => {
    setConfirmModal({
      open: true,
      title: t('backup.restore'),
      message: t('backup.restoreConfirm').replace('{file}', filename),
      type: 'warning',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, loading: true }))
        try {
          setRestoring(filename)
          const res = await api.post('/backup/restore', { filename })
          showMessage('success', t('backup.restored').replace('{rows}', res.data.restoredRows))
          setConfirmModal({ open: false, title: '', message: '', type: 'danger', onConfirm: null })
        } catch (err) {
          showMessage('error', t('backup.restoreFailed'))
          setConfirmModal(m => ({ ...m, loading: false }))
        } finally {
          setRestoring(null)
        }
      }
    })
  }

  const deleteBackupFile = async (filename) => {
    setConfirmModal({
      open: true,
      title: t('backup.delete'),
      message: t('backup.deleteConfirm').replace('{file}', filename),
      type: 'danger',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, loading: true }))
        try {
          setDeleting(filename)
          await api.delete(`/backup/${filename}`)
          showMessage('success', t('backup.deleted'))
          loadBackups()
          setConfirmModal({ open: false, title: '', message: '', type: 'danger', onConfirm: null })
        } catch (err) {
          showMessage('error', t('backup.deleteFailed'))
          setConfirmModal(m => ({ ...m, loading: false }))
        } finally {
          setDeleting(null)
        }
      }
    })
  }

  const uploadToCloud = async (format) => {
    try {
      setUploadingCloud(format)
      const res = await api.post('/backup/cloud/upload', { format })
      showMessage('success', t('backup.cloudUploaded'))
      loadCloudBackups()
    } catch (err) {
      const msg = err.response?.data?.error || t('backup.cloudUploadFailed')
      showMessage('error', msg)
    } finally {
      setUploadingCloud(null)
    }
  }

  const downloadCloudBackup = async (filename) => {
    try {
      const res = await api.get(`/backup/cloud/download/${filename}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      showMessage('error', t('backup.downloadFailed'))
    }
  }

  const deleteCloudBackupFile = async (filename) => {
    setConfirmModal({
      open: true,
      title: t('backup.delete'),
      message: t('backup.deleteConfirm').replace('{file}', filename),
      type: 'danger',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, loading: true }))
        try {
          setDeletingCloud(filename)
          await api.delete(`/backup/cloud/${filename}`)
          showMessage('success', t('backup.deleted'))
          loadCloudBackups()
          setConfirmModal({ open: false, title: '', message: '', type: 'danger', onConfirm: null })
        } catch (err) {
          showMessage('error', t('backup.deleteFailed'))
          setConfirmModal(m => ({ ...m, loading: false }))
        } finally {
          setDeletingCloud(null)
        }
      }
    })
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date) => date ? new Date(date).toLocaleString() : '-'

  return (
    <div className="space-y-6">
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 transition-all duration-300 ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <HardDrive className="w-7 h-7" />
          {t('backup.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('backup.subtitle')}</p>
      </div>

      {/* Auto-Backup Status */}
      <div className={`rounded-2xl border p-6 shadow-sm ${
        autoStatus?.enabled
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              autoStatus?.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              {autoStatus?.enabled ? <Zap className="w-6 h-6 text-green-600 dark:text-green-400" /> : <ZapOff className="w-6 h-6 text-gray-400" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('backup.autoBackup')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {autoStatus?.enabled ? t('backup.autoRunsDaily') : t('backup.autoDisabled')}
              </p>
              {autoStatus?.lastBackupTime && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('backup.lastBackup')}: {formatDate(autoStatus.lastBackupTime)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={toggleAutoBackup}
            disabled={togglingAuto}
            className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
              autoStatus?.enabled
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } disabled:opacity-50`}
          >
            {togglingAuto ? <RefreshCw className="w-4 h-4 animate-spin" /> : autoStatus?.enabled ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {autoStatus?.enabled ? t('backup.disableAuto') : t('backup.enableAuto')}
          </button>
        </div>
      </div>

      {/* Local Backup Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('backup.jsonBackup')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('backup.jsonDesc')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createBackup('json')}
              disabled={creating === 'json'}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {creating === 'json' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {creating === 'json' ? t('backup.creating') : t('backup.createJson')}
            </button>
            <button
              onClick={() => uploadToCloud('json')}
              disabled={uploadingCloud === 'json'}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              title={t('backup.uploadToCloud')}
            >
              {uploadingCloud === 'json' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('backup.sqlBackup')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('backup.sqlDesc')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createBackup('sql')}
              disabled={creating === 'sql'}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {creating === 'sql' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {creating === 'sql' ? t('backup.creating') : t('backup.createSql')}
            </button>
            <button
              onClick={() => uploadToCloud('sql')}
              disabled={uploadingCloud === 'sql'}
              className="px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              title={t('backup.uploadToCloud')}
            >
              {uploadingCloud === 'sql' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Local Backups List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('backup.existingBackups')} ({backups.length})
          </h3>
          <div className="flex items-center gap-2">
            {backups.length > 0 && (
              <button
                onClick={downloadAllBackups}
                disabled={downloadingAll}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {downloadingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                {t('backup.downloadAll')}
              </button>
            )}
            <button onClick={loadBackups} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            {t('backup.loading') || 'Loading...'}
          </div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t('backup.noBackups')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {backups.map((backup) => (
              <div key={backup.name} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  backup.type === 'json' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  {backup.type === 'json' ? <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{backup.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(backup.created)} • {formatSize(backup.size)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => downloadBackup(backup.name)} className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title={t('backup.download')}>
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => restoreBackup(backup.name)} disabled={restoring === backup.name} className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors disabled:opacity-50" title={t('backup.restore')}>
                    {restoring === backup.name ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteBackupFile(backup.name)} disabled={deleting === backup.name} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50" title={t('backup.delete')}>
                    {deleting === backup.name ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cloud Backups List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500" />
            {t('backup.cloudBackups')} ({cloudBackups.length})
          </h3>
          <button onClick={loadCloudBackups} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className={`w-4 h-4 ${cloudLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {cloudLoading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            {t('backup.loading') || 'Loading...'}
          </div>
        ) : cloudBackups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <CloudOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t('backup.noCloudBackups')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {cloudBackups.map((backup) => (
              <div key={backup.name} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  backup.type === 'json' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'
                }`}>
                  {backup.type === 'json' ? <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{backup.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(backup.created)} • {formatSize(backup.size)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => downloadCloudBackup(backup.name)} className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title={t('backup.download')}>
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCloudBackupFile(backup.name)} disabled={deletingCloud === backup.name} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50" title={t('backup.delete')}>
                    {deletingCloud === backup.name ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, title: '', message: '', type: 'danger', onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        loading={confirmModal.loading}
        confirmText={confirmModal.type === 'warning' ? t('backup.restore') : t('backup.delete')}
        cancelText={t('common.cancel') || 'Cancel'}
      />
    </div>
  )
}
