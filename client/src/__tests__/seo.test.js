import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LANDING_SEO } from '../lib/landingSeo'

// The Arabic variant lives at /?lang=ar and must be first-class for SEO:
// full EN/AR metadata parity, hreflang wired in index.html + sitemap.xml,
// and real Arabic text (regression: an earlier encoding bug turned the
// Arabic keywords into '?' mojibake in index.html).
describe('landing SEO - language metadata', () => {
  it('has full EN/AR parity for every field', () => {
    const keys = ['lang', 'title', 'description', 'keywords', 'canonical', 'ogLocale', 'ldName', 'ldDescription']
    for (const key of keys) {
      expect(LANDING_SEO.en[key], `en.${key}`).toBeTruthy()
      expect(LANDING_SEO.ar[key], `ar.${key}`).toBeTruthy()
    }
  })

  it('points each language at its own canonical URL', () => {
    expect(LANDING_SEO.en.canonical).toBe('https://dukkanza.com/')
    expect(LANDING_SEO.ar.canonical).toBe('https://dukkanza.com/?lang=ar')
  })

  it('Arabic copy is real Arabic, not mojibake', () => {
    const ar = Object.values(LANDING_SEO.ar).join(' ')
    expect(ar).toMatch(/[\u0600-\u06FF]/) // Arabic block present
    expect(ar).toContain('دكانزا') // brand in Arabic script
    expect(ar).not.toMatch(/\?{3,}|Ã|â€/) // no double-encoding artefacts
  })

  it('targets the managed solutions in both languages', () => {
    expect(LANDING_SEO.en.keywords.toLowerCase()).toContain('pos')
    expect(LANDING_SEO.ar.keywords).toContain('نقطة بيع') // POS
    expect(LANDING_SEO.ar.keywords).toContain('إدارة المخزون') // inventory
    expect(LANDING_SEO.ar.keywords).toContain('برنامج محاسبة') // accounting
  })
})

describe('landing SEO - crawler wiring', () => {
  const read = (p) => readFileSync(join(process.cwd(), p), 'utf8')

  it('index.html declares hreflang alternates for both languages', () => {
    const html = read('index.html')
    expect(html).toContain('hreflang="en"')
    expect(html).toContain('hreflang="ar"')
    expect(html).toContain('hreflang="x-default"')
    expect(html).toContain('https://dukkanza.com/?lang=ar')
  })

  it('sitemap.xml advertises language variants with alternates', () => {
    const sm = read('public/sitemap.xml')
    expect(sm).toContain('xmlns:xhtml')
    expect(sm).toContain('hreflang="ar"')
    expect(sm).toContain('https://dukkanza.com/?lang=ar')
  })
})
