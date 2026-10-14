// Translate server error responses into the active UI language.
//
// The API returns stable machine-readable codes (see server/src/middleware/
// auth.js). This module maps those codes — plus the legacy English messages
// emitted by servers that predate the `code` field — to translation keys, so
// every toast/surface that shows `err.response.data.error` reads naturally in
// both English and Arabic. Unknown codes/messages return null and the caller
// keeps the raw server text.
import { translations } from './translations'

// Server error `code` -> translation key
const CODE_KEYS = {
  PERMISSION_ROLE_REQUIRED: 'error.insufficientPermissions',
  PERMISSION_MISSING: 'error.insufficientPermissions',
  PERMISSION_MANAGER_REQUIRED: 'error.managerRequired',
  PERMISSION_SUPER_ADMIN_REQUIRED: 'error.superAdminRequired',
  PERMISSION_CANNOT_GRANT_ROLE: 'error.cannotGrantRole',
  AUTH_TOKEN_MISSING: 'error.tokenRequired',
  AUTH_ACCOUNT_DEACTIVATED: 'error.accountDeactivated',
  STOCK_INSUFFICIENT: 'error.stockInsufficient',
  BRANCH_SAME: 'error.branchSame',
  BRANCH_EMPTY: 'error.branchEmpty',
  BRANCH_DEFAULT_PROTECTED: 'error.branchDefaultProtected',
  BRANCH_INVALID: 'error.branchInvalid',
}

// Legacy English messages (pre-`code` servers / older cached bundles)
const MESSAGE_KEYS = {
  'Insufficient permissions': 'error.insufficientPermissions',
  'Manager access required': 'error.managerRequired',
  'Super admin access required': 'error.superAdminRequired',
  'Access token required': 'error.tokenRequired',
  'Account is deactivated': 'error.accountDeactivated',
}

export function localizeApiError(data) {
  if (!data || typeof data !== 'object') return null
  const key = (typeof data.code === 'string' && CODE_KEYS[data.code]) || MESSAGE_KEYS[data.error]
  if (!key) return null
  let lang = 'en'
  try {
    lang = localStorage.getItem('app_language') || 'en'
  } catch {
    // Non-browser test environment: fall back to English
  }
  return translations[lang]?.[key] || translations.en[key] || null
}
