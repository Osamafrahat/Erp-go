import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import supabase from '../db/supabase.js'
import { authenticateToken, requireManager } from '../middleware/auth.js'
import { listBranches, resolveEffectiveBranch } from '../services/branches.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg })
  }
  next()
}

// Branch visibility needs no elevated role (every signed-in user must see
// their branch for the switcher label); mutations are manager-gated below.
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) return res.json({ data: [], effective_branch_id: null })

    const data = await listBranches(tenantId)
    // Report what the server actually resolved so a client holding a stale
    // persisted selection (archived branch, old tab) can self-correct.
    const effective = await resolveEffectiveBranch({
      tenantId,
      userId: req.user?.id,
      role: req.user?.role,
      headerBranchId: req.get('x-branch-id'),
    })
    res.json({ data, effective_branch_id: effective })
  } catch (err) {
    next(err)
  }
})

router.post(
  '/',
  authenticateToken,
  requireManager,
  [
    body('name').trim().notEmpty().withMessage('Branch name is required'),
    body('type').optional().isIn(['store', 'warehouse']).withMessage('Type must be store or warehouse'),
    body('code').optional({ nullable: true }).trim().isLength({ max: 32 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 300 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId
      if (!tenantId) return res.status(400).json({ error: 'A tenant is required', code: 'TENANT_REQUIRED' })

      const { name, code, type, address, phone } = req.body
      const { data, error } = await supabase
        .from('branches')
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          code: code || null,
          type: type || 'store',
          address: address || null,
          phone: phone || null,
        })
        .select('*')
        .single()

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'A branch with this name already exists', code: 'BRANCH_NAME_TAKEN' })
        }
        console.error('[BRANCHES] create failed:', error.message)
        return res.status(500).json({ error: 'Failed to create branch' })
      }
      req.logActivity?.({ action: 'created', entity_type: 'branch', entity_name: data.name, entity_id: data.id })
      res.status(201).json({ data })
    } catch (err) {
      next(err)
    }
  }
)

router.put(
  '/:id',
  authenticateToken,
  requireManager,
  [
    body('name').optional().trim().notEmpty().withMessage('Branch name cannot be empty'),
    body('type').optional().isIn(['store', 'warehouse']).withMessage('Type must be store or warehouse'),
    body('code').optional({ nullable: true }).trim().isLength({ max: 32 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 300 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId
      const id = Number(req.params.id)
      if (!tenantId || !id) return res.status(400).json({ error: 'Invalid branch id', code: 'BRANCH_INVALID' })

      const patch = {}
      if (typeof req.body.name === 'string') patch.name = req.body.name.trim()
      if (typeof req.body.type === 'string') patch.type = req.body.type
      if ('code' in req.body) patch.code = req.body.code || null
      if ('address' in req.body) patch.address = req.body.address || null
      if ('phone' in req.body) patch.phone = req.body.phone || null
      if (typeof req.body.is_active === 'boolean') patch.is_active = req.body.is_active
      // is_default is intentionally NOT updatable — the default branch is
      // fixed (created by backfill/signup); switching default-ness is out
      // of scope for this pass.

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'No fields to update', code: 'NO_FIELDS' })
      }
      patch.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('branches')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select('*')
        .maybeSingle()

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'A branch with this name already exists', code: 'BRANCH_NAME_TAKEN' })
        }
        console.error('[BRANCHES] update failed:', error.message)
        return res.status(500).json({ error: 'Failed to update branch' })
      }
      if (!data) return res.status(404).json({ error: 'Branch not found', code: 'BRANCH_INVALID' })
      req.logActivity?.({ action: 'updated', entity_type: 'branch', entity_name: data.name, entity_id: data.id })
      res.json({ data })
    } catch (err) {
      next(err)
    }
  }
)

// ARCHIVE, never destroy — historical orders/movements keep their FK.
router.delete(
  '/:id',
  authenticateToken,
  requireManager,
  async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId
      const id = Number(req.params.id)
      if (!tenantId || !id) return res.status(400).json({ error: 'Invalid branch id', code: 'BRANCH_INVALID' })

      const { data: existing } = await supabase
        .from('branches')
        .select('id, is_default, is_active, name')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!existing) return res.status(404).json({ error: 'Branch not found', code: 'BRANCH_INVALID' })
      if (existing.is_default) {
        return res.status(400).json({
          error: 'The default branch cannot be archived',
          code: 'BRANCH_DEFAULT_PROTECTED',
        })
      }

      const { data, error } = await supabase
        .from('branches')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select('*')
        .maybeSingle()

      if (error) {
        console.error('[BRANCHES] archive failed:', error.message)
        return res.status(500).json({ error: 'Failed to archive branch' })
      }
      req.logActivity?.({ action: 'archived', entity_type: 'branch', entity_name: data.name, entity_id: data.id })
      res.json({ message: 'Branch archived', data })
    } catch (err) {
      next(err)
    }
  }
)

export default router
