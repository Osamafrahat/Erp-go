const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://xktxbqflzdldzpogklhw.supabase.co',
  'sb_publishable_3SBBhgyhtncukiMNbkLxvw_8hJLGSNn'
)

;(async () => {
  // Test exec_sql
  console.log('Testing exec_sql...')
  const { data, error } = await supabase.rpc('exec_sql', { sql: "DELETE FROM tenants WHERE id = 25;" })
  if (error) console.error('exec_sql error:', error.message)
  else console.log('exec_sql result:', data)

  // Check if deleted
  const { data: remaining } = await supabase.from('tenants').select('id, name')
  console.log('Remaining:', remaining)
})()
