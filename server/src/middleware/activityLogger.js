import supabase from '../db/supabase.js'

/**
 * Log an activity to the audit trail
 * @param {object} params
 * @param {number} params.user_id - The user who performed the action
 * @param {string} params.user_name - The user's display name
 * @param {string} params.action - The action performed (e.g., 'created', 'updated', 'deleted')
 * @param {string} params.entity_type - The type of entity (e.g., 'product', 'order', 'user')
 * @param {number} params.entity_id - The ID of the entity
 * @param {string} params.entity_name - The display name of the entity
 * @param {object} params.details - Additional details (e.g., old/new values)
 * @param {string} params.ip_address - The IP address of the request
 * @param {number} params.tenant_id - The tenant ID (required for webhook/cron contexts where RLS is not set)
 */
export async function logActivity({ user_id, user_name, action, entity_type, entity_id, entity_name, details = {}, ip_address, tenant_id }) {
  try {
    const entry = {
      user_id,
      user_name,
      action,
      entity_type,
      entity_id: entity_id || null,
      entity_name: entity_name || null,
      details,
      ip_address: ip_address || null,
    }
    if (tenant_id) entry.tenant_id = tenant_id
    await supabase.from('activity_log').insert([entry])
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}

/**
 * Middleware to extract user info from request and attach logActivity helper
 */
export function activityLogger(req, res, next) {
  req.logActivity = (params) => {
    const user = req.user || {}
    return logActivity({
      user_id: user.id || null,
      user_name: user.full_name || user.username || 'System',
      ip_address: req.ip || req.connection?.remoteAddress,
      tenant_id: user.tenantId || null,
      ...params,
    })
  }
  next()
}
