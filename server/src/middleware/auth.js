import jwt from 'jsonwebtoken'
import supabase from '../db/supabase.js'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required')
  process.exit(1)
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

export function generateSessionToken() {
  return crypto.randomUUID()
}

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      sessionToken: user.session_token
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    try {
      const { data: user } = await supabase
        .from('users')
        .select('session_token, is_active')
        .eq('id', decoded.id)
        .single()

      // User was deleted
      if (!user) {
        return res.status(401).json({ error: 'Account not found', sessionExpired: true })
      }

      // Account is deactivated
      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated', sessionExpired: true })
      }

      // Session invalidated (deactivated, deleted, or new login)
      if (decoded.sessionToken && user.session_token && decoded.sessionToken !== user.session_token) {
        return res.status(401).json({ error: 'Session expired. Another login was detected.', sessionExpired: true })
      }

      // Session cleared (force logout)
      if (decoded.sessionToken && !user.session_token) {
        return res.status(401).json({ error: 'Session expired. Account was deactivated.', sessionExpired: true })
      }
    } catch {
      // Graceful fallback if session_token column doesn't exist
    }

    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

export function requireManager(req, res, next) {
  if (!req.user || req.user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Manager access required' })
  }
  next()
}

export function requirePermission(...permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    // Manager bypasses all permission checks
    if (req.user.role === 'MANAGER') {
      return next()
    }
    try {
      const { data: user } = await supabase
        .from('users')
        .select('permissions')
        .eq('id', req.user.id)
        .single()
      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }
      let userPermissions = user.permissions
      if (typeof userPermissions === 'string') {
        try {
          userPermissions = JSON.parse(userPermissions)
        } catch {
          userPermissions = []
        }
      }
      const hasPermission = permissions.some(p => userPermissions?.includes(p))
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      next()
    } catch {
      return res.status(500).json({ error: 'Failed to check permissions' })
    }
  }
}
