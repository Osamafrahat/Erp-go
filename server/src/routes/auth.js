import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { generateToken, generateSessionToken, authenticateToken } from '../middleware/auth.js'
import { logActivity } from '../middleware/activityLogger.js'
import supabase from '../db/supabase.js'

const router = Router()

router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { username, password } = req.body

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, full_name, role, permissions, is_active, must_change_password, session_token, employee_id, last_login')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const newSessionToken = generateSessionToken()

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        session_token: newSessionToken
      })
      .eq('id', user.id)

    if (updateError) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
    }

    const token = generateToken({ ...user, session_token: updateError ? null : newSessionToken })

    const { password: _, ...userWithoutPassword } = user

    logActivity({
      user_id: user.id,
      user_name: user.full_name || user.username,
      action: 'logged_in',
      entity_type: 'auth',
      entity_name: user.username,
      ip_address: req.ip || req.connection?.remoteAddress,
    })

    res.json({ token, user: userWithoutPassword })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg })
    }

    const { currentPassword, newPassword } = req.body
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', userId)
      .single()

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        must_change_password: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) throw updateError

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, phone, email, role, permissions, is_active, employee_id, last_login, created_at, updated_at')
      .eq('id', req.user.id)
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/profile', authenticateToken, [
  body('phone').optional().trim(),
  body('email').optional().trim().isEmail().withMessage('Invalid email format'),
], async (req, res) => {
  try {
    const { phone, email } = req.body

    const updateData = { updated_at: new Date().toISOString() }
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email || null

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.user.id)
      .select('id, username, full_name, phone, email, role, permissions, is_active, employee_id, last_login, created_at, updated_at')
      .single()

    if (error) throw error

    res.json(user)
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Invalidate session token server-side
    if (req.user?.id) {
      await supabase
        .from('users')
        .update({ session_token: null, updated_at: new Date().toISOString() })
        .eq('id', req.user.id)
    }

    logActivity({
      user_id: req.user?.id,
      user_name: req.user?.full_name || req.user?.username,
      action: 'logged_out',
      entity_type: 'auth',
      entity_name: req.user?.username,
      ip_address: req.ip || req.connection?.remoteAddress,
    })
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    console.error('Logout error:', err)
    res.json({ message: 'Logged out successfully' })
  }
})

export { router as authRouter }
