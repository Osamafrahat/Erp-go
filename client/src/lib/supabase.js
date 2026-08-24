import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured = !!(supabaseUrl && supabaseKey)

if (!isConfigured) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Chat features will be disabled until these are configured.'
  )
}

// Stub client: every method returns a chainable no-op so supabase.channel(...).on(...).subscribe()
// and supabase.removeChannel() never crash when env vars are missing.
function createStubClient() {
  const stub = () => stub
  stub.then = undefined
  stub.channel = () => ({
    on: () => ({ on: () => ({ subscribe: () => stub }) }),
    subscribe: () => stub,
  })
  stub.removeChannel = () => Promise.resolve()
  stub.from = () => stub
  stub.select = () => stub
  stub.insert = () => Promise.resolve({ data: null, error: null })
  stub.update = () => Promise.resolve({ data: null, error: null })
  stub.delete = () => Promise.resolve({ data: null, error: null })
  stub.upsert = () => Promise.resolve({ data: null, error: null })
  return stub
}

const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createStubClient()

export default supabase
