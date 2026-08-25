import { Router } from 'express'
import supabase from '../db/supabase.js'
import { authenticateToken, requirePermission } from '../middleware/auth.js'
import { createJournalEntry } from '../services/accountingEngine.js'
import { sanitizeSearch } from '../helpers/search.js'

const router = Router()

// Get all journal entries
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, date_from, date_to, source_type, search, period_id } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, accounts(code, name, account_type))', { count: 'exact' })
      .eq('tenant_id', req.user.tenantId)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (date_from) query = query.gte('date', date_from)
    if (date_to) query = query.lte('date', date_to)
    if (source_type) query = query.eq('source_type', source_type)
    if (period_id) query = query.eq('period_id', period_id)
    if (search) {
      const s = sanitizeSearch(search)
      if (s) query = query.or(`description.ilike.%${s}%,entry_number.ilike.%${s}%,reference.ilike.%${s}%`)
    }

    const { data, error, count } = await query
    if (error) throw error

    res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    console.error('Get journal entries error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get single journal entry
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, accounts(code, name, account_type))')
      .eq('tenant_id', req.user.tenantId)
      .eq('id', req.params.id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Journal entry not found' })
    res.json(data)
  } catch (err) {
    console.error('Get journal entry error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create manual journal entry
router.post('/', authenticateToken, requirePermission('accounting_edit', 'accounting_post'), async (req, res) => {
  try {
    const { date, description, reference, lines } = req.body
    if (!description || !lines || lines.length < 2) {
      return res.status(400).json({ error: 'Description and at least 2 lines are required' })
    }

    const entry = await createJournalEntry({
      date,
      description,
      reference,
      sourceType: 'manual',
      lines,
      createdBy: req.user?.id,
    })

    res.status(201).json(entry)
    req.logActivity({ action: 'created', entity_type: 'journal_entry', entity_id: entry.id, entity_name: entry.entry_number, details: { description, source_type: 'manual' } })
  } catch (err) {
    console.error('Create journal entry error:', err)
    res.status(400).json({ error: err.message || 'Internal server error' })
  }
})

// Reverse a journal entry
router.post('/:id/reverse', authenticateToken, requirePermission('accounting_edit', 'accounting_post'), async (req, res) => {
  try {
    const { data: original, error: fetchError } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*)')
      .eq('tenant_id', req.user.tenantId)
      .eq('id', req.params.id)
      .single()

    if (fetchError || !original) return res.status(404).json({ error: 'Entry not found' })
    if (original.is_reversed) return res.status(400).json({ error: 'Entry is already reversed' })

    // Create reverse entry (swap debits and credits)
    const reverseLines = original.journal_entry_lines.map(l => ({
      accountId: l.account_id,
      debit: parseFloat(l.credit),
      credit: parseFloat(l.debit),
      description: `Reversal of ${original.entry_number}`,
    }))

    const reverseEntry = await createJournalEntry({
      date: new Date().toISOString().split('T')[0],
      description: `Reversal of: ${original.description}`,
      reference: original.entry_number,
      sourceType: 'reversal',
      sourceId: original.id,
      lines: reverseLines,
      createdBy: req.user?.id,
    })

    // Mark original as reversed
    await supabase
      .from('journal_entries')
      .update({ is_reversed: true, reversed_by: reverseEntry.id })
      .eq('tenant_id', req.user.tenantId)
      .eq('id', original.id)

    res.json(reverseEntry)
    req.logActivity({ action: 'reversed', entity_type: 'journal_entry', entity_id: original.id, entity_name: original.entry_number, details: { reversed_by: reverseEntry.entry_number } })
  } catch (err) {
    console.error('Reverse journal entry error:', err)
    res.status(400).json({ error: err.message || 'Internal server error' })
  }
})

// Delete draft journal entry (only non-posted)
router.delete('/:id', authenticateToken, requirePermission('accounting_edit'), async (req, res) => {
  try {
    const { data: entry } = await supabase
      .from('journal_entries')
      .select('is_posted')
      .eq('tenant_id', req.user.tenantId)
      .eq('id', req.params.id)
      .single()

    if (entry?.is_posted) {
      return res.status(400).json({ error: 'Cannot delete posted entries. Reverse instead.' })
    }

    const { error } = await supabase.from('journal_entries').delete().eq('tenant_id', req.user.tenantId).eq('id', req.params.id)
    if (error) throw error
    req.logActivity({ action: 'deleted', entity_type: 'journal_entry', entity_id: req.params.id })
    res.json({ message: 'Entry deleted' })
  } catch (err) {
    console.error('Delete journal entry error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as journalsRouter }
