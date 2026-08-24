import { createClient } from '@supabase/supabase-js'

// Publishable (anon) keys — safe for client-side use
// These should be set via VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://onjyobpimcvqwncmvdwi.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_M9lqWHx3In7RU6ZmOvgKbA_tQzHJ5lq'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
