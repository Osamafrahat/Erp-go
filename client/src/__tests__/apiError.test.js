import { describe, it, expect, beforeEach } from 'vitest'
import { localizeApiError } from '../lib/apiError'

describe('localizeApiError', () => {
  beforeEach(() => {
    localStorage.setItem('app_language', 'en')
  })

  it('returns null for missing or non-object payloads', () => {
    expect(localizeApiError(null)).toBeNull()
    expect(localizeApiError(undefined)).toBeNull()
    expect(localizeApiError('Insufficient permissions')).toBeNull()
  })

  it('translates PERMISSION_MISSING in English by default', () => {
    const msg = localizeApiError({ error: 'You do not have permission to perform this action', code: 'PERMISSION_MISSING' })
    expect(msg).toContain('permission')
    expect(msg).not.toContain('undefined')
  })

  it('translates PERMISSION_MISSING in Arabic when selected', () => {
    localStorage.setItem('app_language', 'ar')
    const msg = localizeApiError({ error: 'x', code: 'PERMISSION_MISSING' })
    expect(msg).toContain('صلاحية')
  })

  it('translates manager and super admin requirements', () => {
    expect(localizeApiError({ code: 'PERMISSION_MANAGER_REQUIRED' })).toContain('manager')
    localStorage.setItem('app_language', 'ar')
    expect(localizeApiError({ code: 'PERMISSION_SUPER_ADMIN_REQUIRED' })).toContain('المدير العام')
  })

  it('falls back to legacy English messages when no code is present', () => {
    expect(localizeApiError({ error: 'Insufficient permissions' })).toContain('permission')
    expect(localizeApiError({ error: 'Manager access required' })).toContain('manager')
    expect(localizeApiError({ error: 'Super admin access required' })).toContain('super admin')
    localStorage.setItem('app_language', 'ar')
    expect(localizeApiError({ error: 'Insufficient permissions' })).toContain('صلاحية')
  })

  it('translates the deactivated-account 403', () => {
    localStorage.setItem('app_language', 'ar')
    expect(localizeApiError({ error: 'Your account has been deactivated', code: 'AUTH_ACCOUNT_DEACTIVATED' })).toContain('تعطيل')
  })

  it('returns null for unknown codes and messages', () => {
    expect(localizeApiError({ error: 'Something odd', code: 'WEIRD_CODE' })).toBeNull()
    expect(localizeApiError({ error: 'Something odd' })).toBeNull()
  })
})
