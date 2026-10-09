import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { loginLimiter, resetLoginLimiter } from '../middleware/loginLimiter.js'

// The lockout is wall-clock driven, so the clock is driven by hand rather than
// slept on: Date.now() is the only time source loginLimiter reads.
const BASE = 1_700_000_000_000
const WINDOW_MS = 15 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

describe('loginLimiter', () => {
  let clock
  let nowSpy

  beforeEach(() => {
    resetLoginLimiter()
    clock = BASE
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  function attempt(ip = '203.0.113.7') {
    const res = {
      headers: {},
      set(name, value) {
        res.headers[name] = value
        return res
      },
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    const next = jest.fn()
    loginLimiter({ ip }, res, next)
    return { res, next }
  }

  /** Burn `count` attempts, stepping the clock so timestamps stay distinct. */
  function fire(count, ip) {
    const results = []
    for (let i = 0; i < count; i += 1) {
      results.push(attempt(ip))
      clock += 5
    }
    return results
  }

  const allowed = ({ next, res }) =>
    next.mock.calls.length === 1 && res.status.mock.calls.length === 0

  const messageOf = ({ res }) => res.json.mock.calls[0][0].error

  it('lets the first 10 attempts through untouched', () => {
    const results = fire(10)
    expect(results.every(allowed)).toBe(true)
  })

  it('locks on the 11th attempt with a 2-minute message', () => {
    fire(10)
    const eleventh = attempt()

    expect(eleventh.next).not.toHaveBeenCalled()
    expect(eleventh.res.status).toHaveBeenCalledWith(429)
    expect(messageOf(eleventh)).toBe(
      'Too many login attempts. Please try again in 2 minutes.'
    )
  })

  it('advertises Retry-After in seconds', () => {
    fire(10)
    const eleventh = attempt()
    expect(eleventh.res.headers['Retry-After']).toBe('120')
  })

  it('keeps rejecting for the whole lockout', () => {
    fire(10)
    attempt() // lock for 2 minutes

    clock += 30 * 1000
    expect(allowed(attempt())).toBe(false)

    clock += 60 * 1000
    expect(allowed(attempt())).toBe(false)
  })

  it('counts down and switches to singular below a minute', () => {
    fire(10)
    attempt() // the lock is now armed for 2 minutes

    clock += 119 * 1000 // one minute of the two left, minus a second
    expect(messageOf(attempt())).toBe(
      'Too many login attempts. Please try again in 1 minute.'
    )
  })

  it('escalates the next lockout to 5 minutes', () => {
    fire(10)
    attempt()
    clock += 2 * 60 * 1000 + 1 // serve the first sentence

    fire(10)
    const second = attempt()
    expect(messageOf(second)).toBe(
      'Too many login attempts. Please try again in 5 minutes.'
    )
    expect(second.res.headers['Retry-After']).toBe('300')
  })

  it('escalates the third lockout to 15 minutes', () => {
    fire(10)
    attempt()
    clock += 2 * 60 * 1000 + 1
    fire(10)
    attempt()
    clock += 5 * 60 * 1000 + 1

    fire(10)
    expect(messageOf(attempt())).toBe(
      'Too many login attempts. Please try again in 15 minutes.'
    )
  })

  it('caps the ladder at 15 minutes', () => {
    fire(10)
    attempt()
    clock += 2 * 60 * 1000 + 1
    fire(10)
    attempt()
    clock += 5 * 60 * 1000 + 1
    fire(10)
    attempt()
    clock += 15 * 60 * 1000 + 1

    fire(10)
    expect(messageOf(attempt())).toBe(
      'Too many login attempts. Please try again in 15 minutes.'
    )
  })

  it('decays the ladder back to 2 minutes after a quiet hour', () => {
    fire(10)
    attempt()
    clock += 2 * 60 * 1000 + 1
    fire(10)
    attempt()
    clock += 5 * 60 * 1000 + 1
    fire(10)
    attempt() // now at the 15-minute rung

    clock += HOUR_MS + 60 * 1000 // nobody tries anything for an hour

    fire(10)
    expect(messageOf(attempt())).toBe(
      'Too many login attempts. Please try again in 2 minutes.'
    )
  })

  it('forgets attempts once they fall outside the window', () => {
    fire(10) // ten inside the window, none of them locking
    clock += WINDOW_MS + 1000

    expect(allowed(attempt())).toBe(true)
  })

  it('does not lock other clients out', () => {
    fire(10, '203.0.113.7')
    expect(allowed(attempt('203.0.113.7'))).toBe(false) // 11th, now locked

    expect(allowed(attempt('198.51.100.4'))).toBe(true)
    expect(allowed(attempt('198.51.100.4'))).toBe(true)
  })
})
