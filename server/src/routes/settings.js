import { Router } from 'express'
import { authenticateToken, requirePermission } from '../middleware/auth.js'
import supabase from '../db/supabase.js'

const router = Router()

const ALLOWED_SETTINGS = [
  'storeName', 'storeAddress', 'storePhone', 'storeLogo',
  'taxRate', 'currency', 'currencySymbol',
  'receiptFooter', 'lowStockThreshold',
  'loyaltyPointsPerCurrency',
  'eta_client_id', 'eta_client_secret', 'eta_pos_serial',
  'eta_registration_number', 'eta_activity_code',
  'eta_store_governate', 'eta_auto_submit',
  'attendance.lateGraceMinutes', 'attendance.overtimeThresholdHours',
  'attendance.autoClockOut', 'attendance.autoClockOutTime',
  'attendance.enableGeolocation', 'attendance.requiredRadiusMeters',
  'attendance.storeLatitude', 'attendance.storeLongitude',
]

const PUBLIC_SETTINGS = [
  'storeName', 'storeAddress', 'storePhone', 'storeLogo',
  'taxRate', 'currency', 'currencySymbol',
  'receiptFooter', 'lowStockThreshold',
  'loyaltyPointsPerCurrency',
]

const ALL_ALLOWED_SETTINGS = [
  ...PUBLIC_SETTINGS,
  'eta_client_id', 'eta_client_secret', 'eta_pos_serial',
  'eta_registration_number', 'eta_activity_code',
  'eta_store_governate', 'eta_auto_submit',
  'attendance.lateGraceMinutes', 'attendance.overtimeThresholdHours',
  'attendance.autoClockOut', 'attendance.autoClockOutTime',
  'attendance.enableGeolocation', 'attendance.requiredRadiusMeters',
  'attendance.storeLatitude', 'attendance.storeLongitude',
]

const HIDDEN_SETTINGS = ['eta_client_secret']

// Public endpoint - no auth needed (login page, receipt, etc.)
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', PUBLIC_SETTINGS)
      .eq('tenant_id', req.user?.tenantId)

    if (error) throw error

    const settings = {}
    data.forEach(s => { settings[s.key] = s.value })
    res.json(settings)
  } catch (err) {
    next(err)
  }
})

// Protected endpoint - all settings (requires auth)
router.get('/all', authenticateToken, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ALL_ALLOWED_SETTINGS)
      .eq('tenant_id', req.user.tenantId)

    if (error) throw error

    const settings = {}
    data.forEach(s => {
      if (!HIDDEN_SETTINGS.includes(s.key)) {
        settings[s.key] = s.value
      }
    })
    res.json(settings)
  } catch (err) {
    next(err)
  }
})

router.put('/', authenticateToken, requirePermission('settings_edit'), async (req, res, next) => {
  try {
    const settings = req.body

    const entries = Object.entries(settings).filter(([key]) => 
      ALLOWED_SETTINGS.includes(key)
    )

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' })
    }

    const rows = entries.map(([key, value]) => ({ key, value: String(value), tenant_id: req.user.tenantId }))

    const { error } = await supabase
      .from('store_settings')
      .upsert(rows, { onConflict: 'tenant_id,key' })

    if (error) throw error

    res.json({ message: 'Settings updated successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
