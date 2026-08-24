import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Chat features will be disabled until these are configured in Vercel.'
  )
}

// Proxy stub returns no-ops when Supabase is not configured,
// preventing the app from crashing on import
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : new Proxy({}, {
      get: () => new Proxy({}, {
        get: () => new Proxy({}, {
          get: () => () => ({ data: null, error: new Error('Supabase not configured') }),
        }),
      }),
    })

export default supabase
