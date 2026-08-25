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

// Get all expenses
router.get('/', async (req, res, next) => {
  try {
    const { start_date, end_date, category } = req.query

    let query = supabase
      .from('expenses')
      .select('*, users(full_name)')
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false })

    if (start_date) {
      query = query.gte('expense_date', start_date)
    }
    if (end_date) {
      query = query.lte('expense_date', end_date)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error

    res.json(data || [])
  } catch (err) {
    next(err)
  }
})

// Get expense summary
router.get('/summary', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let query = supabase
      .from('expenses')
      .select('category, amount')
      .eq('tenant_id', req.user.tenantId)

    if (start_date) {
      query = query.gte('expense_date', start_date)
    }
    if (end_date) {
      query = query.lte('expense_date', end_date)
    }

    const { data, error } = await query
    if (error) throw error

    // Group by category
    const summary = {}
    data.forEach(expense => {
      if (!summary[expense.category]) {
        summary[expense.category] = 0
      }
      summary[expense.category] += expense.amount
    })

    const total = data.reduce((sum, e) => sum + e.amount, 0)

    res.json({ summary, total })
  } catch (err) {
    next(err)
  }
})

// Create expense
router.post('/', authenticateToken, requirePermission('expenses_edit'), [
  body('category').trim().notEmpty().withMessage('Expense category is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
], validate, async (req, res, next) => {
  try {
    const { category, amount, description, receipt_image, expense_date, method } = req.body

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        tenant_id: req.user.tenantId,
        category,
        amount,
        description: description || null,
        receipt_image: receipt_image || null,
        recorded_by: req.user?.id || null,
        expense_date: expense_date || new Date().toISOString().split('T')[0],
        method: method || 'cash'
      })
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'created', entity_type: 'expense', entity_name: data.category })

    // Auto-post to accounting journal
    try {
      const { postExpenseJournal } = await import('../services/accountingEngine.js')
      await postExpenseJournal(data)
    } catch (accErr) {
      console.error('Accounting auto-post failed:', accErr.message)
    }

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// Update expense
router.put('/:id', authenticateToken, requirePermission('expenses_edit'), [
  param('id').isNumeric().withMessage('Invalid expense ID'),
  body('category').trim().notEmpty().withMessage('Expense category is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
], validate, async (req, res, next) => {
  try {
    const { category, amount, description, receipt_image, expense_date } = req.body

    const { data, error } = await supabase
      .from('expenses')
      .update({
        category,
        amount,
        description: description || null,
        receipt_image: receipt_image || null,
        expense_date: expense_date || undefined
      })
      .eq('tenant_id', req.user.tenantId)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    req.logActivity({ action: 'updated', entity_type: 'expense', entity_id: req.params.id })

    // Auto-post accounting: reverse old entry, create new entry
    try {
      const { postExpenseUpdateJournal } = await import('../services/accountingEngine.js')
      await postExpenseUpdateJournal({ id: req.params.id }, data)
    } catch (accErr) {
      console.error('Accounting auto-post failed:', accErr.message)
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// Delete expense
router.delete('/:id', authenticateToken, requirePermission('expenses_edit'), [
  param('id').isNumeric().withMessage('Invalid expense ID'),
], validate, async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('tenant_id', req.user.tenantId)
      .eq('id', req.params.id)

    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'expense', entity_id: req.params.id })

    // Auto-post accounting: reverse the original entry
    try {
      const { reverseJournalEntry } = await import('../services/accountingEngine.js')
      const { data: entry } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('tenant_id', req.user.tenantId)
        .eq('source_type', 'expense')
        .eq('source_id', req.params.id)
        .eq('is_reversed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (entry) await reverseJournalEntry(entry.id, 'Expense deleted', req.user?.id)
    } catch (accErr) {
      console.error('Accounting auto-post failed:', accErr.message)
    }

    res.json({ message: 'Expense deleted successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
