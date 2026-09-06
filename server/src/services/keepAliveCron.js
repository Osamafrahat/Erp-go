import cron from 'node-cron'
import supabase from '../db/supabase.js'

let keepAliveJob = null
let retentionJob = null

const ACTIVITY_RETENTION_DAYS = parseInt(process.env.ACTIVITY_RETENTION_DAYS) || 30

async function pingSupabase() {
  try {
    // Simple query to keep Supabase from pausing due to inactivity
    const { error } = await supabase.from('tenants').select('id').limit(1)
    if (error) {
      console.error('[KeepAlive] Supabase ping failed:', error.message)
    } else {
      console.log('[KeepAlive] Supabase ping successful at', new Date().toISOString())
    }
  } catch (err) {
    console.error('[KeepAlive] Ping error:', err.message)
  }
}

async function purgeOldActivityLogs() {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - ACTIVITY_RETENTION_DAYS)
    const cutoffISO = cutoff.toISOString()

    const { count, error } = await supabase
      .from('activity_log')
      .delete()
      .lt('created_at', cutoffISO)

    if (error) {
      console.error('[Retention] Purge failed:', error.message)
    } else {
      console.log(`[Retention] Purged activity logs older than ${ACTIVITY_RETENTION_DAYS} days`)
    }
  } catch (err) {
    console.error('[Retention] Purge error:', err.message)
  }
}

export function startKeepAliveCron() {
  // Ping Supabase every 12 hours (more reliable than daily for preventing pause)
  keepAliveJob = cron.schedule('0 */12 * * *', pingSupabase)
  console.log('[CRON] Supabase keep-alive started (every 12 hours)')

  // Run once on startup
  setTimeout(pingSupabase, 5000)
}

export function startActivityRetentionCron() {
  // Purge old activity logs daily at 3:00 AM
  retentionJob = cron.schedule('0 3 * * *', purgeOldActivityLogs)
  console.log(`[CRON] Activity log retention started (${ACTIVITY_RETENTION_DAYS} days)`)
}

export { pingSupabase, purgeOldActivityLogs }
