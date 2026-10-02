#!/usr/bin/env node
// Nightly backup runner, invoked by .github/workflows/backup.yml.
//
// The in-process job in backupScheduler.js can only fire while the Fly machine
// is awake. With min_machines_running = 0 and auto_stop_machines = 'stop' the
// machine is asleep at 02:00, so that cron had never actually run. This runs on
// a GitHub runner instead, where there is no process to sleep through it, and
// reuses backupService.js so both paths define "a backup" identically.
//
// Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY.
// SUPABASE_SERVICE_KEY must be a real service_role key. An anon-role JWT is
// accepted by supabase-js and only fails later, inside storage row-level
// security — which is exactly how this backup silently stopped working.

import 'dotenv/config'

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`[NIGHTLY] Missing required environment: ${missing.join(', ')}`)
  console.error('[NIGHTLY] Set these as GitHub Actions secrets on this repository.')
  process.exit(1)
}

// Fail fast and legibly on the anon-key mistake rather than 30 rows deep in an
// opaque "row-level security policy" error. sb_secret_* keys are opaque, so
// only legacy JWT-shaped keys can be inspected.
const serviceKey = process.env.SUPABASE_SERVICE_KEY
const jwtPart = serviceKey.split('.')[1]
if (jwtPart) {
  try {
    const b64 = jwtPart.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    if (payload.role !== 'service_role') {
      console.error(`[NIGHTLY] SUPABASE_SERVICE_KEY has role="${payload.role}", expected "service_role".`)
      console.error('[NIGHTLY] Storage uploads are rejected for anon. Rotate the key:')
      console.error('[NIGHTLY]   Supabase Dashboard -> Project Settings -> API -> service_role secret')
      process.exit(1)
    }
  } catch {
    console.warn('[NIGHTLY] Could not decode SUPABASE_SERVICE_KEY; continuing.')
  }
}

const { backupToCloud, listCloudBackups, deleteCloudBackup } = await import(
  '../src/services/backupService.js'
)

const retentionDays = Math.max(1, parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30)

async function main() {
  const started = Date.now()

  // 1. Capture every table and push the result to Supabase Storage.
  const upload = await backupToCloud('json')
  console.log(`[NIGHTLY] Uploaded ${upload.filename} (${upload.size} bytes, ${upload.totalRows} rows)`)

  // A structurally valid backup holding nothing is a failure, not a success.
  if (!upload.totalRows) {
    console.error('[NIGHTLY] Backup captured 0 rows — treating as failure.')
    process.exit(1)
  }

  // 2. Confirm the object is actually readable from the bucket. An upload that
  //    reports success but leaves nothing behind must not count as a backup.
  const after = await listCloudBackups()
  if (!after.some((f) => f.name === upload.filename)) {
    console.error(`[NIGHTLY] ${upload.filename} is not visible in the bucket listing — verification failed.`)
    process.exit(1)
  }

  // 3. Retention. The in-process cleanup cron ('0 3 * * 0') has the same
  //    sleep problem, so pruning happens here or nothing ever gets deleted.
  const cutoff = Date.now() - retentionDays * 86_400_000
  const stale = after.filter((f) => new Date(f.created).getTime() < cutoff)
  let pruned = 0
  for (const f of stale) {
    try {
      await deleteCloudBackup(f.name)
      pruned++
    } catch (err) {
      console.error(`[NIGHTLY] Could not prune ${f.name}: ${err.message || err}`)
    }
  }

  console.log(`[NIGHTLY] Bucket holds ${after.length} file(s); pruned ${pruned} older than ${retentionDays} days`)
  console.log(`[NIGHTLY] Done in ${Date.now() - started}ms`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[NIGHTLY] Backup FAILED:', err?.message || err)
    process.exit(1)
  })
