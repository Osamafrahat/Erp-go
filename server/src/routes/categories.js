import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all categories
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) throw error
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Create category
router.post('/', authenticateToken, requirePermission('inventory_edit'), [
  body('name').trim().notEmpty().withMessage('Category name is required'),
], validate, async (req, res, next) => {
  try {
    const { name, description } = req.body

    const { data, error } = await supabase
      .from('categories')
      .insert({ name, description: description || null })
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'created', entity_type: 'category', entity_name: data.name })
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update category
router.put('/:id', authenticateToken, requirePermission('inventory_edit'), [
  param('id').isNumeric().withMessage('Invalid category ID'),
  body('name').trim().notEmpty().withMessage('Category name is required'),
], validate, async (req, res, next) => {
  try {
    const { name, description } = req.body

    const { data, error } = await supabase
      .from('categories')
      .update({ name, description: description || null })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'updated', entity_type: 'category', entity_id: req.params.id })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete category
router.delete('/:id', authenticateToken, requirePermission('inventory_edit'), [
  param('id').isNumeric().withMessage('Invalid category ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'category', entity_id: req.params.id })
    res.json({ message: 'Category deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
