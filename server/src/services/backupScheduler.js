import cron from 'node-cron'
import { backupToJson, backupToCloud, cleanupOldBackups, listCloudBackups, deleteCloudBackup } from './backupService.js'

const BACKUP_SCHEDULE = process.env.BACKUP_SCHEDULE || '0 2 * * *'
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30

let backupJob = null
let cleanupJob = null
let autoBackupEnabled = process.env.BACKUP_ENABLED !== 'false'
let lastBackupTime = null

export function startBackupScheduler() {
  if (!autoBackupEnabled) {
    console.log('[CRON] Auto-backup disabled (BACKUP_ENABLED=false)')
    return
  }
  enableAutoBackup()
}

export function enableAutoBackup() {
  try {
    if (backupJob) { backupJob.stop(); backupJob = null }
    if (cleanupJob) { cleanupJob.stop(); cleanupJob = null }

    backupJob = cron.schedule(BACKUP_SCHEDULE, async () => {
      console.log(`[CRON] Running scheduled backup at ${new Date().toISOString()}`)
      try {
        const result = await backupToJson()
        lastBackupTime = new Date().toISOString()
        console.log(`[CRON] Local backup completed: ${result.totalRows} rows`)

        try {
          await backupToCloud('json')
          console.log(`[CRON] Cloud backup uploaded`)
        } catch (cloudErr) {
          console.error('[CRON] Cloud upload failed:', cloudErr.message)
        }
      } catch (err) {
        console.error('[CRON] Backup failed:', err)
      }
    })

    cleanupJob = cron.schedule('0 3 * * 0', async () => {
      console.log(`[CRON] Running weekly cleanup at ${new Date().toISOString()}`)
      try {
        const localResult = await cleanupOldBackups(BACKUP_RETENTION_DAYS)
        console.log(`[CRON] Local cleanup: ${localResult.deleted} old backups removed`)

        const cloudBackups = await listCloudBackups()
        const cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)
        let cloudDeleted = 0
        for (const b of cloudBackups) {
          if (new Date(b.created) < cutoff) {
            await deleteCloudBackup(b.name).catch(() => {})
            cloudDeleted++
          }
        }
        if (cloudDeleted > 0) console.log(`[CRON] Cloud cleanup: ${cloudDeleted} old backups removed`)
      } catch (err) {
        console.error('[CRON] Cleanup failed:', err)
      }
    })

    autoBackupEnabled = true
    console.log(`[CRON] Auto-backup ENABLED: ${BACKUP_SCHEDULE}`)
  } catch (err) {
    console.error('[CRON] Failed to enable auto-backup:', err)
    throw err
  }
}

export function disableAutoBackup() {
  try {
    if (backupJob) { backupJob.stop(); backupJob = null }
    if (cleanupJob) { cleanupJob.stop(); cleanupJob = null }
    autoBackupEnabled = false
    console.log('[CRON] Auto-backup DISABLED')
  } catch (err) {
    console.error('[CRON] Failed to disable auto-backup:', err)
    throw err
  }
}

export function getAutoBackupStatus() {
  return {
    enabled: autoBackupEnabled,
    schedule: BACKUP_SCHEDULE,
    retentionDays: BACKUP_RETENTION_DAYS,
    lastBackupTime,
  }
}
