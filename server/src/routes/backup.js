import { Router } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import {
  backupToJson,
  backupToSql,
  restoreFromJson,
  listBackups,
  deleteBackup,
  cleanupOldBackups,
  backupToCloud,
  listCloudBackups,
  downloadFromCloud,
  deleteCloudBackup
} from '../services/backupService.js'
import { logActivity } from '../middleware/activityLogger.js'
import {
  enableAutoBackup,
  disableAutoBackup,
  getAutoBackupStatus
} from '../services/backupScheduler.js'

const router = Router()
const BACKUP_DIR = path.resolve(process.cwd(), 'backups')

function log(req, params) {
  const user = req.user || {}
  logActivity({
    user_id: user.id || null,
    user_name: user.full_name || user.username || 'System',
    ip_address: req.ip || req.connection?.remoteAddress,
    tenant_id: user.tenantId || null,
    ...params,
  }).catch(() => {})
}

router.get('/', async (req, res) => {
  try {
    const backups = await listBackups()
    res.json(backups)
  } catch (err) {
    console.error('List backups error:', err)
    res.status(500).json({ error: 'Failed to list backups' })
  }
})

router.post('/json', async (req, res) => {
  try {
    log(req, { action: 'created', entity_type: 'backup', entity_name: 'JSON backup' })
    const result = await backupToJson()
    res.json({ message: 'JSON backup created', ...result })
  } catch (err) {
    console.error('JSON backup error:', err)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

router.post('/sql', async (req, res) => {
  try {
    log(req, { action: 'created', entity_type: 'backup', entity_name: 'SQL backup' })
    const result = await backupToSql()
    res.json({ message: 'SQL backup created', ...result })
  } catch (err) {
    console.error('SQL backup error:', err)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

// Sanitize backup filename - prevent path traversal
function isValidBackupFilename(filename) {
  if (!filename || typeof filename !== 'string') return false
  // Only allow alphanumeric, dots, hyphens, underscores
  return /^[a-zA-Z0-9._-]+$/.test(filename) && !filename.includes('..')
}

router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params
    if (!isValidBackupFilename(filename)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    const jsonPath = path.join(BACKUP_DIR, 'json', filename)
    const sqlPath = path.join(BACKUP_DIR, 'sql', filename)

    let filePath
    try { await fs.access(jsonPath); filePath = jsonPath } catch {}
    try { await fs.access(sqlPath); filePath = sqlPath } catch {}

    if (!filePath) return res.status(404).json({ error: 'Backup not found' })

    res.download(filePath, filename)
  } catch (err) {
    console.error('Download backup error:', err)
    res.status(500).json({ error: 'Failed to download backup' })
  }
})

router.post('/restore', async (req, res) => {
  try {
    const { filename } = req.body
    if (!filename) return res.status(400).json({ error: 'Filename is required' })
    if (!isValidBackupFilename(filename)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const jsonPath = path.join(BACKUP_DIR, 'json', filename)
    try { await fs.access(jsonPath) } catch {
      return res.status(404).json({ error: 'JSON backup not found' })
    }

    log(req, { action: 'restored', entity_type: 'backup', entity_name: filename })
    const result = await restoreFromJson(jsonPath)
    res.json({ message: 'Database restored', ...result })
  } catch (err) {
    console.error('Restore error:', err)
    res.status(500).json({ error: 'Failed to restore' })
  }
})

router.delete('/:filename', async (req, res) => {
  try {
    if (!isValidBackupFilename(req.params.filename)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    await deleteBackup(req.params.filename)
    log(req, { action: 'deleted', entity_type: 'backup', entity_name: req.params.filename })
    res.json({ message: 'Backup deleted' })
  } catch (err) {
    console.error('Delete backup error:', err)
    res.status(500).json({ error: 'Failed to delete backup' })
  }
})

router.post('/cleanup', async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 30
    const result = await cleanupOldBackups(days)
    res.json({ message: `Cleaned up backups older than ${days} days`, ...result })
  } catch (err) {
    console.error('Cleanup error:', err)
    res.status(500).json({ error: 'Failed to cleanup' })
  }
})

router.get('/auto-status', (req, res) => {
  try {
    res.json(getAutoBackupStatus())
  } catch (err) {
    console.error('Auto-status error:', err)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

router.post('/auto-enable', (req, res) => {
  try {
    enableAutoBackup()
    log(req, { action: 'updated', entity_type: 'backup', entity_name: 'Auto-backup enabled' })
    res.json({ message: 'Auto-backup enabled', ...getAutoBackupStatus() })
  } catch (err) {
    console.error('Auto-enable error:', err)
    res.status(500).json({ error: 'Failed to enable auto-backup' })
  }
})

router.post('/auto-disable', (req, res) => {
  try {
    disableAutoBackup()
    log(req, { action: 'updated', entity_type: 'backup', entity_name: 'Auto-backup disabled' })
    res.json({ message: 'Auto-backup disabled', ...getAutoBackupStatus() })
  } catch (err) {
    console.error('Auto-disable error:', err)
    res.status(500).json({ error: 'Failed to disable auto-backup' })
  }
})

router.get('/cloud', async (req, res) => {
  try {
    const backups = await listCloudBackups()
    res.json(backups)
  } catch (err) {
    console.error('List cloud backups error:', err)
    res.status(500).json({ error: 'Failed to list cloud backups' })
  }
})

router.post('/cloud/upload', async (req, res) => {
  try {
    const format = req.body.format || 'json'
    log(req, { action: 'created', entity_type: 'cloud_backup', entity_name: `${format.toUpperCase()} cloud backup` })
    const result = await backupToCloud(format)
    res.json({ message: 'Cloud backup uploaded', ...result })
  } catch (err) {
    console.error('Cloud upload error:', err.message || err)
    res.status(500).json({ error: err.message || 'Failed to upload to cloud' })
  }
})

router.get('/cloud/download/:filename', async (req, res) => {
  try {
    if (!isValidBackupFilename(req.params.filename)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    const data = await downloadFromCloud(req.params.filename)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`)
    const buffer = Buffer.from(await data.arrayBuffer())
    res.send(buffer)
  } catch (err) {
    console.error('Cloud download error:', err)
    res.status(500).json({ error: 'Failed to download from cloud' })
  }
})

router.delete('/cloud/:filename', async (req, res) => {
  try {
    if (!isValidBackupFilename(req.params.filename)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    await deleteCloudBackup(req.params.filename)
    log(req, { action: 'deleted', entity_type: 'cloud_backup', entity_name: req.params.filename })
    res.json({ message: 'Cloud backup deleted' })
  } catch (err) {
    console.error('Cloud delete error:', err)
    res.status(500).json({ error: 'Failed to delete cloud backup' })
  }
})

export { router as backupRouter }
