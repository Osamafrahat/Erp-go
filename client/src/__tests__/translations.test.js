import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { translations } from '../lib/translations'
import { localizeApiError } from '../lib/apiError'

// The en/ar dictionaries are maintained by hand in one file. History has
// shown they drift silently (a removed key on one side, a duplicate key
// overwriting its sibling). This suite is the CI gate that was missing.
const file = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'translations.js'),
  'utf8'
)

function keysOf(dict) {
  return Object.keys(dict).sort()
}

describe('translations dictionaries', () => {
  it('has identical key sets in en and ar', () => {
    const en = keysOf(translations.en)
    const ar = keysOf(translations.ar)
    const missingInAr = en.filter((k) => !(k in translations.ar))
    const missingInEn = ar.filter((k) => !(k in translations.en))
    expect({ missingInAr, missingInEn }).toEqual({ missingInAr: [], missingInEn: [] })
  })

  it('has no empty translation values', () => {
    for (const [lang, dict] of Object.entries(translations)) {
      const empty = Object.entries(dict)
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k)
      expect({ lang, empty }).toEqual({ lang, empty: [] })
    }
  })

  it('has no duplicate keys inside either source dictionary', () => {
    // Object literals silently keep the LAST duplicate, so a duplicated key
    // overwrites its sibling with no error anywhere. Detect them in source.
    const arStart = file.indexOf('  ar: {')
    expect(arStart).toBeGreaterThan(0)
    const sections = { en: file.slice(0, arStart), ar: file.slice(arStart) }
    for (const [lang, src] of Object.entries(sections)) {
      const seen = new Map()
      const dups = []
      for (const m of src.matchAll(/^\s*'([\w.-]+)':/gm)) {
        const key = m[1]
        if (seen.has(key)) dups.push(key)
        seen.set(key, true)
      }
      expect({ lang, dups }).toEqual({ lang, dups: [] })
    }
  })

  it('defines every key that apiError.js can emit', () => {
    const required = [
      'error.insufficientPermissions',
      'error.managerRequired',
      'error.superAdminRequired',
      'error.cannotGrantRole',
      'error.tokenRequired',
      'error.accountDeactivated',
      'error.stockInsufficient',
      'error.branchSame',
      'error.branchEmpty',
      'error.branchDefaultProtected',
      'error.branchInvalid',
    ]
    for (const key of required) {
      expect(translations.en[key], `en ${key}`).toBeTruthy()
      expect(translations.ar[key], `ar ${key}`).toBeTruthy()
    }
    // and the localizer resolves them in both languages
    for (const lang of ['en', 'ar']) {
      const prev = localStorage.getItem('app_language')
      localStorage.setItem('app_language', lang)
      expect(localizeApiError({ code: 'PERMISSION_MISSING' })).toBeTruthy()
      if (prev === null) localStorage.removeItem('app_language')
      else localStorage.setItem('app_language', prev)
    }
  })
})
