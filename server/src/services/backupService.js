import supabase, { supabaseStorage } from '../db/supabase.js'
import { promises as fs } from 'fs'
import path from 'path'

const BACKUP_DIR = path.resolve(process.cwd(), 'backups')
const CLOUD_BUCKET = 'backups'

const TABLES = [
  'categories', 'suppliers', 'products', 'customers', 'employees', 'users',
  'accounts', 'fiscal_periods', 'journal_entries', 'journal_entry_lines',
  'payments', 'account_balances', 'promotions', 'orders', 'order_items',
  'payment_splits', 'stock_movements', 'refunds', 'refund_items',
  'expenses', 'store_settings', 'activity_log'
]

// Tables that have tenant_id column
const TENANT_TABLES = [
  'accounts', 'fiscal_periods', 'journal_entries', 'journal_entry_lines',
  'payments', 'account_balances', 'orders', 'order_items',
  'payment_splits', 'stock_movements', 'refunds', 'refund_items',
  'expenses', 'store_settings', 'activity_log',
  'categories', 'suppliers', 'products', 'customers', 'employees', 'users',
  'promotions'
]

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true })
  await fs.mkdir(path.join(BACKUP_DIR, 'json'), { recursive: true })
  await fs.mkdir(path.join(BACKUP_DIR, 'sql'), { recursive: true })
}

function toSqlValue(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

function escapeIdentifier(name) {
  return `"${name}"`
}

export async function backupToJson(tenantId) {
  await ensureBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = { timestamp, tenant_id: tenantId, tables: {} }
  let totalRows = 0

  for (const table of TABLES) {
    let query = supabase.from(table).select('*')
    if (tenantId && TENANT_TABLES.includes(table)) {
      query = query.eq('tenant_id', tenantId)
    }
    const { data, error } = await query
    if (error) {
      console.error(`[BACKUP] Error fetching ${table}:`, error.message)
      backup.tables[table] = { error: error.message, rows: [] }
    } else {
      backup.tables[table] = { rows: data || [], count: (data || []).length }
      totalRows += (data || []).length
    }
  }

  const filePath = path.join(BACKUP_DIR, 'json', `backup-${tenantId || 'global'}-${timestamp}.json`)
  await fs.writeFile(filePath, JSON.stringify(backup, null, 2))
  console.log(`[BACKUP] JSON backup saved: ${filePath} (${totalRows} rows)`)

  return { filePath, timestamp, totalRows, tableCount: TABLES.length }
}

export async function backupToSql(tenantId) {
  await ensureBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const lines = []
  lines.push('-- Store Management System Database Backup')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  if (tenantId) lines.push(`-- Tenant: ${tenantId}`)
  lines.push('--')
  lines.push('')
  let totalRows = 0

  for (const table of TABLES) {
    let query = supabase.from(table).select('*')
    if (tenantId && TENANT_TABLES.includes(table)) {
      query = query.eq('tenant_id', tenantId)
    }
    const { data, error } = await query
    if (error || !data || data.length === 0) {
      if (error) console.error(`[BACKUP] Error fetching ${table}:`, error.message)
      continue
    }

    lines.push(`-- Table: ${table} (${data.length} rows)`)
    lines.push(`TRUNCATE TABLE ${escapeIdentifier(table)} CASCADE;`)
    lines.push('')

    if (data.length > 0) {
      const columns = Object.keys(data[0])
      const colList = columns.map(c => escapeIdentifier(c)).join(', ')

      for (const row of data) {
        const values = columns.map(c => toSqlValue(row[c])).join(', ')
        lines.push(`INSERT INTO ${escapeIdentifier(table)} (${colList}) VALUES (${values});`)
      }
      totalRows += data.length
    }
    lines.push('')
  }

  const filePath = path.join(BACKUP_DIR, 'sql', `backup-${tenantId || 'global'}-${timestamp}.sql`)
  await fs.writeFile(filePath, lines.join('\n'))
  console.log(`[BACKUP] SQL backup saved: ${filePath} (${totalRows} rows)`)

  return { filePath, timestamp, totalRows, tableCount: TABLES.length }
}

export async function restoreFromJson(filePath, tenantId) {
  const content = await fs.readFile(filePath, 'utf-8')
  const backup = JSON.parse(content)
  let restoredRows = 0
  const results = []

  for (const table of TABLES) {
    const tableData = backup.tables?.[table]
    if (!tableData?.rows || tableData.rows.length === 0) continue

    try {
      let deleteQuery = supabase.from(table).delete().neq('id', 0)
      if (tenantId && TENANT_TABLES.includes(table)) {
        deleteQuery = deleteQuery.eq('tenant_id', tenantId)
      }
      const { error } = await deleteQuery
      if (error && !error.message.includes('No rows')) {
        results.push({ table, status: 'error', message: error.message })
        continue
      }

      // Ensure tenant_id is set on restored rows
      const rowsToInsert = tenantId
        ? tableData.rows.map(row => ({ ...row, tenant_id: tenantId }))
        : tableData.rows

      const batchSize = 50
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize)
        const { error: insertErr } = await supabase.from(table).insert(batch)
        if (insertErr) {
          results.push({ table, status: 'partial', message: insertErr.message, rows: i })
          break
        }
      }

      restoredRows += rowsToInsert.length
      results.push({ table, status: 'ok', rows: rowsToInsert.length })
    } catch (err) {
      results.push({ table, status: 'error', message: err.message })
    }
  }

  console.log(`[RESTORE] Restored ${restoredRows} rows from ${filePath}`)
  return { restoredRows, results }
}

export async function listBackups() {
  await ensureBackupDir()
  const backups = []

  try {
    const jsonFiles = await fs.readdir(path.join(BACKUP_DIR, 'json'))
    for (const file of jsonFiles) {
      const stat = await fs.stat(path.join(BACKUP_DIR, 'json', file))
      backups.push({
        name: file,
        type: 'json',
        size: stat.size,
        created: stat.birthtime,
        path: path.join(BACKUP_DIR, 'json', file)
      })
    }
  } catch {}

  try {
    const sqlFiles = await fs.readdir(path.join(BACKUP_DIR, 'sql'))
    for (const file of sqlFiles) {
      const stat = await fs.stat(path.join(BACKUP_DIR, 'sql', file))
      backups.push({
        name: file,
        type: 'sql',
        size: stat.size,
        created: stat.birthtime,
        path: path.join(BACKUP_DIR, 'sql', file)
      })
    }
  } catch {}

  backups.sort((a, b) => new Date(b.created) - new Date(a.created))
  return backups
}

export async function deleteBackup(filename) {
  const jsonPath = path.join(BACKUP_DIR, 'json', filename)
  const sqlPath = path.join(BACKUP_DIR, 'sql', filename)

  let deleted = false
  try { await fs.unlink(jsonPath); deleted = true } catch {}
  try { await fs.unlink(sqlPath); deleted = true } catch {}

  if (!deleted) throw new Error('Backup not found')
  return { deleted: true, filename }
}

export async function cleanupOldBackups(retentionDays = 30) {
  await ensureBackupDir()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  let deleted = 0

  for (const dir of ['json', 'sql']) {
    try {
      const files = await fs.readdir(path.join(BACKUP_DIR, dir))
      for (const file of files) {
        const filePath = path.join(BACKUP_DIR, dir, file)
        const stat = await fs.stat(filePath)
        if (stat.birthtime < cutoff) {
          await fs.unlink(filePath)
          deleted++
        }
      }
    } catch {}
  }

  console.log(`[BACKUP] Cleaned up ${deleted} old backups (>${retentionDays} days)`)
  return { deleted }
}

export async function ensureCloudBucket() {
  try {
    const { data: buckets } = await supabaseStorage.storage.listBuckets()
    const exists = buckets?.some(b => b.name === CLOUD_BUCKET)
    if (!exists) {
      const { error } = await supabaseStorage.storage.createBucket(CLOUD_BUCKET, { public: false })
      if (error) {
        console.error(`[BACKUP] Cannot create bucket "${CLOUD_BUCKET}". Create it manually in Supabase Dashboard > Storage.`)
      } else {
        console.log(`[BACKUP] Created cloud bucket: ${CLOUD_BUCKET}`)
      }
    }
  } catch (err) {
    console.error('[BACKUP] Bucket check error:', err.message)
  }
}

export async function backupToCloud(format = 'json', tenantId) {
  await ensureCloudBucket()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup-${tenantId || 'global'}-${timestamp}.${format}`

  let fileContent
  if (format === 'sql') {
    const result = await backupToSql(tenantId)
    fileContent = await fs.readFile(result.filePath)
  } else {
    const result = await backupToJson(tenantId)
    fileContent = await fs.readFile(result.filePath)
  }

  const { error } = await supabaseStorage.storage
    .from(CLOUD_BUCKET)
    .upload(filename, fileContent, {
      contentType: format === 'json' ? 'application/json' : 'application/sql',
      upsert: true,
    })

  if (error) throw error

  console.log(`[BACKUP] Cloud backup uploaded: ${filename}`)
  return { filename, timestamp, size: fileContent.length }
}

export async function listCloudBackups() {
  await ensureCloudBucket()
  const { data, error } = await supabaseStorage.storage.from(CLOUD_BUCKET).list('', {
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) throw error

  return (data || []).map(f => ({
    name: f.name,
    type: f.name.endsWith('.sql') ? 'sql' : 'json',
    size: f.metadata?.size || 0,
    created: f.created_at,
  }))
}

export async function downloadFromCloud(filename) {
  const { data, error } = await supabaseStorage.storage.from(CLOUD_BUCKET).download(filename)
  if (error) throw error
  return data
}

export async function deleteCloudBackup(filename) {
  const { error } = await supabaseStorage.storage.from(CLOUD_BUCKET).remove([filename])
  if (error) throw error
  return { deleted: true, filename }
}
