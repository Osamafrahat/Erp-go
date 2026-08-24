import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'
import { sanitizeSearch } from '../helpers/search.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all customers
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query
    let query = supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (search) {
      const s = sanitizeSearch(search)
      if (s) query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%`)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Get customer by ID
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid customer ID'),
], validate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Create customer
router.post('/', authenticateToken, requirePermission('customers_edit'), [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
], validate, async (req, res, next) => {
  try {
    const { name, phone, email, address, notes } = req.body

    // Check if phone number already exists
    if (phone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, name')
        .eq('phone', phone)
        .eq('is_active', true)
        .limit(1)

      if (existing && existing.length > 0) {
        return res.status(400).json({
          error: `This phone number is already registered to: ${existing[0].name}`
        })
      }
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null
      })
      .select()
      .single()

    if (error) throw error

    // Auto-assign account_code for per-customer AR tracking
    const accountCode = `1030-C${data.id}`
    await supabase
      .from('customers')
      .update({ account_code: accountCode })
      .eq('id', data.id)

    data.account_code = accountCode

    req.logActivity({ action: 'created', entity_type: 'customer', entity_name: data.name })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update customer
router.put('/:id', authenticateToken, requirePermission('customers_edit'), [
  param('id').isNumeric().withMessage('Invalid customer ID'),
  body('name').trim().notEmpty().withMessage('Customer name is required'),
], validate, async (req, res, next) => {
  try {
    const { name, phone, email, address, notes } = req.body

    // Check if phone number already exists (excluding current customer)
    if (phone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, name')
        .eq('phone', phone)
        .eq('is_active', true)
        .neq('id', req.params.id)
        .limit(1)

      if (existing && existing.length > 0) {
        return res.status(400).json({
          error: `This phone number is already registered to: ${existing[0].name}`
        })
      }
    }

    const { data, error } = await supabase
      .from('customers')
      .update({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'updated', entity_type: 'customer', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete customer (soft delete)
router.delete('/:id', authenticateToken, requirePermission('customers_edit'), [
  param('id').isNumeric().withMessage('Invalid customer ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'customer', entity_id: req.params.id })
    res.json({ message: 'Customer deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
