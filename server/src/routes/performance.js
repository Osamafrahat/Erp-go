import { Router } from 'express'
import { param, body, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { requireManager, authenticateToken, requirePermission } from '../middleware/auth.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Get all performance reviews
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, status } = req.query
    let query = supabase
      .from('performance_reviews')
      .select('*, employees(name, role), users!performance_reviews_reviewer_id_fkey(full_name)')
      .order('created_at', { ascending: false })
    if (employee_id) query = query.eq('employee_id', employee_id)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get performance review by ID with criteria
router.get('/:id', [
  param('id').isNumeric().withMessage('Invalid review ID'),
], validate, async (req, res, next) => {
  try {
    const { data: review, error } = await supabase
      .from('performance_reviews')
      .select('*, employees(name, role), users!performance_reviews_reviewer_id_fkey(full_name)')
      .eq('id', req.params.id)
      .single()
    if (error || !review) {
      return res.status(404).json({ error: 'Performance review not found' })
    }

    const { data: criteria } = await supabase
      .from('review_criteria')
      .select('*')
      .eq('review_id', review.id)
      .order('id')

    res.json({ ...review, criteria: criteria || [] })
  } catch (err) {
    next(err)
  }
})

// Create performance review
router.post('/', requirePermission('hr_edit'), [
  body('employee_id').isNumeric().withMessage('Employee ID is required'),
  body('review_period_start').isISO8601().withMessage('Review period start is required'),
  body('review_period_end').isISO8601().withMessage('Review period end is required'),
], validate, async (req, res, next) => {
  try {
    const { employee_id, review_period_start, review_period_end, strengths, improvements, goals, comments, overall_rating, criteria } = req.body

    const { data: review, error } = await supabase
      .from('performance_reviews')
      .insert({
        employee_id,
        reviewer_id: req.user.id,
        review_period_start,
        review_period_end,
        overall_rating: overall_rating || null,
        strengths: strengths || null,
        improvements: improvements || null,
        goals: goals || null,
        comments: comments || null,
        status: 'draft',
      })
      .select('*, employees(name, role), users!performance_reviews_reviewer_id_fkey(full_name)')
      .single()
    if (error) throw error

    // Insert criteria if provided
    if (criteria && Array.isArray(criteria) && criteria.length > 0) {
      const criteriaRows = criteria.map(c => ({
        review_id: review.id,
        criterion: c.criterion,
        rating: c.rating || null,
        comments: c.comments || null,
      }))
      await supabase.from('review_criteria').insert(criteriaRows)
    }

    res.status(201).json(review)
  } catch (err) {
    next(err)
  }
})

// Update performance review
router.put('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid review ID'),
], validate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('performance_reviews')
      .select('id')
      .eq('id', req.params.id)
      .single()

    if (!existing) {
      return res.status(404).json({ error: 'Performance review not found' })
    }

    const { strengths, improvements, goals, comments, overall_rating, status, criteria } = req.body

    const { data, error } = await supabase
      .from('performance_reviews')
      .update({
        strengths,
        improvements,
        goals,
        comments,
        overall_rating,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*, employees(name, role), users!performance_reviews_reviewer_id_fkey(full_name)')
      .single()
    if (error) throw error

    // Update criteria if provided
    if (criteria && Array.isArray(criteria)) {
      await supabase.from('review_criteria').delete().eq('review_id', req.params.id)
      if (criteria.length > 0) {
        const criteriaRows = criteria.map(c => ({
          review_id: parseInt(req.params.id),
          criterion: c.criterion,
          rating: c.rating || null,
          comments: c.comments || null,
        }))
        await supabase.from('review_criteria').insert(criteriaRows)
      }
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete performance review
router.delete('/:id', requirePermission('hr_edit'), [
  param('id').isNumeric().withMessage('Invalid review ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('performance_reviews')
      .delete()
      .eq('id', req.params.id)
    if (error) throw error
    res.json({ message: 'Performance review deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
