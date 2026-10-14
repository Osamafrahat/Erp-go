import supabase from '../db/supabase.js'

// Branch helpers: default-branch self-healing and effective-branch
// resolution for the setTenantContext middleware.

// Roles that may operate in ANY branch of their tenant (the switcher in
// the client is gated the same way). Everyone else stays pinned to their
// home branch (users.branch_id) or the tenant default.
const SWITCHABLE_ROLES = new Set(['MANAGER', 'SUPER_ADMIN'])

/**
 * Returns the tenant's default branch, creating "Main Branch" on first
 * use (self-healing for tenants created between the schema migration and
 * code deploy, or if a creation path ever misses it).
 */
export async function ensureDefaultBranch(tenantId) {
  if (!tenantId) return null

  const { data: existing } = await supabase
    .from('branches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .maybeSingle()
  if (existing) return existing

  const { data: created, error } = await supabase
    .from('branches')
    .insert({
      tenant_id: tenantId,
      name: 'Main Branch',
      code: 'MAIN',
      type: 'store',
      is_default: true,
    })
    .select('*')
    .single()
  if (!error && created) return created

  // Likely the unique partial index racing a concurrent request — read the
  // winner instead of failing.
  const { data: retry } = await supabase
    .from('branches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .maybeSingle()
  return retry
}

export async function listBranches(tenantId) {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (error) {
    console.error('[BRANCHES] list failed:', error.message)
    return []
  }
  return data || []
}

// A user's pinned home branch, but only if it still belongs to this tenant
// and is active — otherwise null (caller falls back to the default).
async function pinnedHomeBranchId(userId, tenantId) {
  if (!userId) return null
  const { data } = await supabase
    .from('users')
    .select('branch_id')
    .eq('id', userId)
    .maybeSingle()
  const home = data?.branch_id
  if (!home) return null

  const { data: b } = await supabase
    .from('branches')
    .select('id, tenant_id, is_active')
    .eq('id', home)
    .maybeSingle()
  if (b && Number(b.tenant_id) === Number(tenantId) && b.is_active) return Number(b.id)
  return null
}

/**
 * Validates an optional branch_id request field against the tenant.
 * Returns `{ ok: true, value: number|null }` — value null means "absent or
 * cleared" — or `{ ok: false }` when the id names a branch outside this
 * tenant (caller should 400 BRANCH_INVALID).
 */
export async function resolveBranchParam(tenantId, branchId) {
  if (branchId === undefined || branchId === null || branchId === '') {
    return { ok: true, value: null }
  }
  const id = Number(branchId)
  if (!id) return { ok: false }
  const { data } = await supabase
    .from('branches')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle()
  if (!data || Number(data.tenant_id) !== Number(tenantId)) return { ok: false }
  return { ok: true, value: id }
}

/**
 * Which branch this request operates in. Returns a branch id, or null for
 * tenant-less (platform) users or total resolution failure.
 *
 * Priority:
 *   1. `x-branch-id` header — trusted only for MANAGER/SUPER_ADMIN, and
 *      only when it names an ACTIVE branch of their own tenant. Everyone
 *      else's header is ignored (pinned users cannot wander).
 *   2. The user's pinned home branch (non-switchable roles).
 *   3. The tenant default branch (self-healed to a Main Branch if missing).
 *
 * Invalid/stale headers resolve to the fallback rather than erroring — a
 * branch archived while a client held it in localStorage must not break
 * the whole app. GET /api/branches reports the resolved id back so the
 * client can correct its persisted selection.
 */
export async function resolveEffectiveBranch({ tenantId, userId, role, headerBranchId }) {
  if (!tenantId) return null
  const canSwitch = SWITCHABLE_ROLES.has(role)

  if (headerBranchId && canSwitch) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id, tenant_id, is_active')
      .eq('id', headerBranchId)
      .maybeSingle()
    if (branch && Number(branch.tenant_id) === Number(tenantId) && branch.is_active) {
      return Number(branch.id)
    }
  }

  if (!canSwitch) {
    const home = await pinnedHomeBranchId(userId, tenantId)
    if (home) return home
  }

  const fallback = await ensureDefaultBranch(tenantId)
  return fallback ? Number(fallback.id) : null
}
