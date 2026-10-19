// email footer copyright.
//
// Every outgoing email must end with the platform copyright line
// "© {year} Dukkanza. All rights reserved." (bilingual: the Arabic
// all-rights text travels with it). These tests read the service source
// and pin the invariant so no future template ships without it -
// a bare `© {year}` footer regressed once already.

import { readFileSync } from 'node:fs'
import { jest } from '@jest/globals'

const source = readFileSync(new URL('../services/emailService.js', import.meta.url), 'utf8')

describe('email footer copyright', () => {
  it('every HTML footer carries the Dukkanza copyright line', () => {
    const footers = source.match(/class="footer"/g) || []
    const rights = source.match(/Dukkanza\. All rights reserved\./g) || []
    expect(footers.length).toBeGreaterThan(0)
    expect(rights.length).toBe(footers.length)
  })

  it('keeps the Arabic all-rights text alongside the English line', () => {
    const arabic = source.match(/جميع الحقوق محفوظة/g) || []
    const rights = source.match(/Dukkanza\. All rights reserved\./g) || []
    expect(arabic.length).toBe(rights.length)
  })

  it('uses the current year, not a hardcoded one', () => {
    expect(source).toContain('&copy; ${new Date().getFullYear()} Dukkanza'.replace('&copy;', '\u00A9'))
    expect(source).not.toMatch(/© 20\d\d Dukkanza/)
  })
})
