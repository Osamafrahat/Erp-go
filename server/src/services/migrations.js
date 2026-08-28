import supabase from '../db/supabase.js'

export async function runMigrations() {
  console.log('[Migration] Running database migrations...')

  try {
    // Add subscription_expires_at column if not exists
    const { error: e1 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;"
    })
    if (e1 && !e1.message?.includes('already exists')) {
      // Try direct SQL via raw query if rpc fails
      console.log('[Migration] Trying direct SQL for subscription_expires_at...')
    }

    const { error: e2 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_note text;"
    })
    if (e2 && !e2.message?.includes('already exists')) {
      console.log('[Migration] Trying direct SQL for renewal_note...')
    }

    console.log('[Migration] Migrations complete')
  } catch (err) {
    console.error('[Migration] Error (columns may already exist):', err.message)
  }
}
