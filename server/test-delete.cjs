const { createClient } = require('@supabase/supabase-js')
const s = createClient('https://xktxbqflzdldzpogklhw.supabase.co', 'sb_publishable_3SBBhgyhtncukiMNbkLxvw_8hJLGSNn')
;(async () => {
  // Try direct delete from tenants table
  const { data, error } = await s.from('tenants').delete().eq('id', 25).select()
  if (error) console.error('Direct delete error:', error.message)
  else console.log('Direct delete OK:', data)

  const { data: d } = await s.from('tenants').select('id, name')
  console.log('Tenants:', JSON.stringify(d))
})()
