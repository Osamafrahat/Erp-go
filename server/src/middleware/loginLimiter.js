// Login lockout — deliberately NOT express-rate-limit.
//
// That library's penalty is whatever is left of its fixed window, so someone who
// mistyped a password early in a 15-minute window ate the whole 15 minutes no
// matter when they gave up waiting. This one ladders instead: the first lockout
// is 2 minutes, repeat offences lengthen it (2 -> 5 -> 15), and the ladder
// decays after a quiet hour so an old mistake stops haunting the account. The
// reply always reports the time actually left, never a hardcoded figure.
//
// Shared by /api/auth/login and /api/auth/change-password, keyed by client IP
// (index.js sets `trust proxy` to 1, so req.ip is the caller and not Fly's edge).

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_LOCKOUT_MS = [2, 5, 15].map((m) => m * 60 * 1000)
const LOGIN_STRIKE_TTL_MS = 60 * 60 * 1000

const loginAttempts = new Map() // ip -> { hits, lockUntil, strikes, lastLockAt, lastSeen }

function lockoutMessage(remainingMs) {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000))
  return `Too many login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

export function loginLimiter(req, res, next) {
  const now = Date.now()
  let record = loginAttempts.get(req.ip)
  if (!record) {
    record = { hits: [], lockUntil: 0, strikes: 0, lastLockAt: 0, lastSeen: 0 }
    loginAttempts.set(req.ip, record)
  }
  record.lastSeen = now

  if (record.lockUntil > now) {
    res.set('Retry-After', String(Math.ceil((record.lockUntil - now) / 1000)))
    return res.status(429).json({ error: lockoutMessage(record.lockUntil - now) })
  }

  // Ladder decays once the account has been quiet for a full hour.
  if (record.strikes > 0 && now - record.lastLockAt > LOGIN_STRIKE_TTL_MS) {
    record.strikes = 0
  }

  // Rolling window: anything older than the window drops off as the new attempt
  // lands, so the count cannot be reset by waiting just inside the interval.
  record.hits = [...record.hits, now].filter((t) => now - t < LOGIN_WINDOW_MS)

  if (record.hits.length > LOGIN_MAX_ATTEMPTS) {
    const duration = LOGIN_LOCKOUT_MS[Math.min(record.strikes, LOGIN_LOCKOUT_MS.length - 1)]
    record.strikes += 1
    record.lastLockAt = now
    record.lockUntil = now + duration
    record.hits = [] // the lock IS the penalty; start the next window clean
    res.set('Retry-After', String(Math.ceil(duration / 1000)))
    return res.status(429).json({ error: lockoutMessage(duration) })
  }

  next()
}

// Keep the map bounded: an entry is droppable once its lock has expired and it
// has not been touched for a whole window. unref() so this timer never keeps
// the process — or Jest's --detectOpenHandles — alive.
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of loginAttempts) {
    if (record.lockUntil < now && now - record.lastSeen > LOGIN_WINDOW_MS) {
      loginAttempts.delete(ip)
    }
  }
}, LOGIN_WINDOW_MS)
sweep.unref()

/** Test hook: forget every tracked IP so cases start from a clean slate. */
export function resetLoginLimiter() {
  loginAttempts.clear()
}
