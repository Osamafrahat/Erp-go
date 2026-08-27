import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required')
  process.exit(1)
}

// Use service key for server-side (bypasses RLS). Tenant isolation is handled
// by JWT auth + setTenantContext middleware, not RLS.
const supabase = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : createClient(supabaseUrl, supabaseKey)

// Storage client with service key (full access) — falls back to anon key
const supabaseStorage = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : supabase

export { supabaseStorage }

export function withTimeout(promise, ms, label = 'Query') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

export default supabase
