import { Router } from 'express'
import supabase from '../db/supabase.js'
import { sanitizeSearch } from '../helpers/search.js'

const router = Router()

// Manager-only middleware
const managerOnly = (req, res, next) => {
  if (req.user?.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Access denied. Manager only.' })
  }
  next()
}

// Get all activities with pagination and filters
router.get('/', managerOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entity_type, user_id, search } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false })

    if (action) query = query.eq('action', action)
    if (entity_type) query = query.eq('entity_type', entity_type)
    if (user_id) query = query.eq('user_id', user_id)
    if (search) {
      const s = sanitizeSearch(search)
      if (s) query = query.or(`user_name.ilike.%${s}%,entity_name.ilike.%${s}%,action.ilike.%${s}%`)
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)

    if (error) throw error

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      }
    })
  } catch (err) {
    console.error('Failed to fetch activities:', err)
    res.status(500).json({ error: 'Failed to fetch activities' })
  }
})

// Get activity summary stats
router.get('/stats', managerOnly, async (req, res) => {
  try {
    const { data: allActivities } = await supabase
      .from('activity_log')
      .select('action, entity_type, user_name, created_at')
      .eq('tenant_id', req.user.tenantId)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayActivities = (allActivities || []).filter(a => new Date(a.created_at) >= today)

    const actionCounts = {}
    const entityCounts = {}
    const userCounts = {}

    todayActivities.forEach(a => {
      actionCounts[a.action] = (actionCounts[a.action] || 0) + 1
      entityCounts[a.entity_type] = (entityCounts[a.entity_type] || 0) + 1
      if (a.user_name) {
        userCounts[a.user_name] = (userCounts[a.user_name] || 0) + 1
      }
    })

    res.json({
      totalToday: todayActivities.length,
      totalAll: (allActivities || []).length,
      byAction: actionCounts,
      byEntity: entityCounts,
      byUser: userCounts,
    })
  } catch (err) {
    console.error('Failed to fetch activity stats:', err)
    res.status(500).json({ error: 'Failed to fetch activity stats' })
  }
})

// Create a new activity log entry
router.post('/', managerOnly, async (req, res) => {
  try {
    const { user_id, user_name, action, entity_type, entity_id, entity_name, details, ip_address } = req.body

    const { data, error } = await supabase
      .from('activity_log')
      .insert([{
        tenant_id: req.user.tenantId,
        user_id,
        user_name,
        action,
        entity_type,
        entity_id,
        entity_name,
        details: details || {},
        ip_address,
      }])
      .select()
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (err) {
    console.error('Failed to create activity:', err)
    res.status(500).json({ error: 'Failed to create activity' })
  }
})

// Delete old activities (cleanup)
router.delete('/cleanup', managerOnly, async (req, res) => {
  try {
    const { days = 90 } = req.query
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(days))

    const { error, count } = await supabase
      .from('activity_log')
      .delete()
      .eq('tenant_id', req.user.tenantId)
      .lt('created_at', cutoff.toISOString())

    if (error) throw error

    res.json({ deleted: count || 0, message: `Activities older than ${days} days deleted` })
  } catch (err) {
    console.error('Failed to cleanup activities:', err)
    res.status(500).json({ error: 'Failed to cleanup activities' })
  }
})

export default router
