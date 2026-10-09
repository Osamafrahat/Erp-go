import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { loginLimiter, resetLoginLimiter } from '../middleware/loginLimiter.js'

// The lockout is wall-clock driven, so the clock is driven by hand rather than
// slept on: Date.now() is the only time source loginLimiter reads.
const BASE = 1_700_000_000_000
const WINDOW_MS = 15 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const IP = '203.0.113.7'
const OTHER_IP = '198.51.100.4'

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

  /** One pass through the middleware. respond() plays the handler's verdict. */
  function invoke(ip) {
    const finishers = []
    const res = {
      statusCode: 200,
      headers: {},
      set(name, value) {
        res.headers[name] = value
        return res
      },
      status: jest.fn((code) => {
        res.statusCode = code
        return res
      }),
      json: jest.fn().mockReturnThis(),
      on(event, cb) {
        if (event === 'finish') finishers.push(cb)
        return res
      },
    }
    const next = jest.fn()
    loginLimiter({ ip }, res, next)
    return {
      res,
      next,
      respond(statusCode) {
        res.statusCode = statusCode
        finishers.forEach((cb) => cb())
      },
    }
  }

  const passed = (r) => r.next.mock.calls.length === 1
  const messageOf = (r) => r.res.json.mock.calls[0][0].error

  /** A wrong password: the handler runs and rejects it with 401. */
  function wrongPassword(ip = IP) {
    const r = invoke(ip)
    if (passed(r)) r.respond(401)
    clock += 5
    return r
  }

  /** A correct password: the handler runs and admits them with 200. */
  function correctPassword(ip = IP) {
    const r = invoke(ip)
    if (passed(r)) r.respond(200)
    clock += 5
    return r
  }

  const latch = () => {
    const r = invoke(IP)
    expect(passed(r)).toBe(false)
    expect(r.res.status).toHaveBeenCalledWith(429)
    return r
  }

  it('latches the door after three wrong passwords', () => {
    expect(passed(wrongPassword())).toBe(true) // 1st, let through
    expect(passed(wrongPassword())).toBe(true) // 2nd, let through
    expect(passed(wrongPassword())).toBe(true) // 3rd, answered then latched

    expect(messageOf(latch())).toBe(
      'Too many login attempts. Please try again in 2 minutes.'
    )
  })

  it('never counts a correct sign-in', () => {
    for (let i = 0; i < 20; i += 1) correctPassword()

    expect(passed(invoke(IP))).toBe(true)
  })

  it('a correct sign-in wipes the failures already recorded', () => {
    wrongPassword()
    wrongPassword()
    correctPassword() // slate back to empty

    wrongPassword()
    wrongPassword()
    expect(passed(invoke(IP))).toBe(true) // only two since the reset

    wrongPassword() // the third one latches
    expect(passed(invoke(IP))).toBe(false)
  })

  it('advertises Retry-After in seconds', () => {
    wrongPassword()
    wrongPassword()
    wrongPassword()

    expect(latch().res.headers['Retry-After']).toBe('120')
  })

  it('keeps rejecting while the lock runs, counting down', () => {
    wrongPassword()
    wrongPassword()
    wrongPassword() // latched

    clock += 30 * 1000 // 90s of the 120s left
    expect(messageOf(invoke(IP))).toBe(
      'Too many login attempts. Please try again in 2 minutes.'
    )

    clock += 60 * 1000 // 30s left -> singular
    expect(messageOf(invoke(IP))).toBe(
      'Too many login attempts. Please try again in 1 minute.'
    )
  })

  it('escalates the next lockout to 5 minutes', () => {
    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 2 * 60 * 1000 + 1 // serve the first sentence

    wrongPassword()
    wrongPassword()
    wrongPassword()

    const r = latch()
    expect(messageOf(r)).toBe(
      'Too many login attempts. Please try again in 5 minutes.'
    )
    expect(r.res.headers['Retry-After']).toBe('300')
  })

  it('escalates the third lockout to 15 minutes', () => {
    wrongPassword()
    wrongPassword()
    wrongPassword() // 1st lock: 2 minutes
    clock += 2 * 60 * 1000 + 1

    wrongPassword()
    wrongPassword()
    wrongPassword() // 2nd lock: 5 minutes
    clock += 5 * 60 * 1000 + 1

    wrongPassword()
    wrongPassword()
    wrongPassword() // 3rd lock: 15 minutes — deliberately still in force here

    expect(messageOf(latch())).toBe(
      'Too many login attempts. Please try again in 15 minutes.'
    )
  })

  it('caps the ladder at 15 minutes', () => {
    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 2 * 60 * 1000 + 1

    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 5 * 60 * 1000 + 1

    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 15 * 60 * 1000 + 1 // three rungs climbed, lock served

    wrongPassword()
    wrongPassword()
    wrongPassword() // fourth lock must not run past the cap

    expect(messageOf(latch())).toBe(
      'Too many login attempts. Please try again in 15 minutes.'
    )
  })

  it('decays back to 2 minutes after a quiet hour', () => {
    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 2 * 60 * 1000 + 1

    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 5 * 60 * 1000 + 1

    wrongPassword()
    wrongPassword()
    wrongPassword()
    clock += 15 * 60 * 1000 + 1 // sitting on the top rung, lock expired

    clock += HOUR_MS + 60 * 1000 // then an hour with nobody trying anything

    wrongPassword()
    wrongPassword()
    wrongPassword()
    expect(messageOf(latch())).toBe(
      'Too many login attempts. Please try again in 2 minutes.'
    )
  })

  it('does not count a throttled response as a wrong password', () => {
    for (let i = 0; i < 3; i += 1) {
      const r = invoke(IP)
      if (passed(r)) r.respond(429) // some other limiter said no
      clock += 5
    }

    expect(passed(invoke(IP))).toBe(true)
  })

  it('forgets failures older than the window', () => {
    wrongPassword()
    wrongPassword()
    clock += WINDOW_MS + 1000 // both age out

    wrongPassword()
    wrongPassword()
    expect(passed(invoke(IP))).toBe(true) // would have latched had they counted
  })

  it('does not lock other clients out', () => {
    wrongPassword(IP)
    wrongPassword(IP)
    wrongPassword(IP)
    expect(passed(invoke(IP))).toBe(false)

    expect(passed(invoke(OTHER_IP))).toBe(true)
    expect(passed(invoke(OTHER_IP))).toBe(true)
  })
})
