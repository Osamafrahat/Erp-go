import { describe, it, expect } from '@jest/globals'
import { openBlocker, closeBlocker } from '../services/cashBoxPolicy.js'

describe('openBlocker', () => {
  it('lets a cashier with no box of their own open one', () => {
    // The common case, and the one this rule exists to protect: a second
    // cashier arriving mid-shift must not be told someone else holds a box.
    expect(openBlocker(null)).toBeNull()
    expect(openBlocker(undefined)).toBeNull()
  })

  it('blocks a second box for the same cashier', () => {
    const own = { id: 'shift-1', user_id: 'user-a', status: 'open' }
    expect(openBlocker(own)).toMatch(/already have an open cash box/)
  })
})

describe('closeBlocker', () => {
  const shift = { id: 'shift-1', user_id: 'user-a', status: 'open' }

  it('lets the cashier who opened the box close it', () => {
    expect(closeBlocker(shift, 'user-a')).toBeNull()
  })

  it('refuses anyone else', () => {
    expect(closeBlocker(shift, 'user-b')).toMatch(
      /Only the cashier who opened this cash box/
    )
  })

  it('refuses a caller with no id, rather than failing open', () => {
    expect(closeBlocker(shift, undefined)).not.toBeNull()
    expect(closeBlocker(shift, null)).not.toBeNull()
  })

  it('still refuses when the shift itself is missing', () => {
    expect(closeBlocker(null, 'user-a')).not.toBeNull()
  })
})
