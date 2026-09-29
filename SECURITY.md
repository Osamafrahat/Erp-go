# Security Checklist for Production

> **Status:** this document previously described controls that did not match the
> code (24-hour tokens, 10 MB body limit, 100 req/15 min rate limit, a SQLite
> database the project has never used, and "all routes require authentication").
> Every figure below is now verified against `server/src/index.js` and
> `server/src/routes/auth.js`.

## Applied Controls

### 1. Authentication & Authorization
- [x] JWT token-based authentication, with a per-session `session_token` that is re-read from the DB on every request (so logout / force-logout actually invalidates tokens)
- [x] Password hashing with bcrypt (10 rounds for user passwords, 12 for the bootstrap super admin)
- [x] Token expiration — default `24h` in code, but **every shipped env template sets `JWT_EXPIRES_IN=7d`**. Treat 7 days as the real value unless you override it.
- [x] Protected API routes with authentication middleware
- [x] Role-based access control (RBAC)
- [x] Login and change-password rate limited to 10 attempts / 15 min
- [x] Super-admin bootstrap endpoint is disabled unless `BOOTSTRAP_SUPERADMIN_TOKEN` is set, is creation-only, and never resets an existing password

### 2. Input Validation
- [x] Server-side input validation with express-validator on the main write routes
- [x] SQL injection prevention (parameterized PostgREST queries) — the raw-SQL
      `exec_sql` interpolation path in `superAdmin.js` has been replaced with
      parameterized `.eq()` deletes
- [x] Request body size limit — **5 MB** (`express.json({ limit: '5mb' })`)
- [x] Required field validation

### 3. Security Headers
- [x] Helmet.js for HTTP security headers
- [x] X-Powered-By disabled
- [x] Content Security Policy enabled
- [x] CORS configured via `ALLOWED_ORIGINS` — **must be set in production**; with `NODE_ENV=production` and no `ALLOWED_ORIGINS`, all cross-origin requests are refused

### 4. Rate Limiting
- [x] General API rate limit — **500 requests / 15 min per IP**
- [x] Strict auth rate limit — 10 attempts / 15 min
- [x] Brute force protection
- [ ] `checkTenantLimits()` currently **fails open** on a counting error and
      counts all-time rows against a *monthly* column, so plan limits are not
      reliably enforced

### 5. Error Handling
- [x] No internal error messages leaked in production (central `errorHandler`)
- [x] Proper HTTP status codes
- [x] Error logging without exposing internals
- [ ] Several route handlers still return `err.message` directly; the highest-risk
      files have been corrected, but a sweep of all ~66 occurrences remains open

### 6. Payments
- [x] Stripe webhook signature verified
- [x] Paymob callback verified — HMAC signature (when `PAYMOB_HMAC_SECRET` is set)
      **plus** an authoritative re-fetch from Paymob's API before any subscription
      tier is granted
- [x] Payment webhook payloads are no longer logged in full

## Before Deployment

### Environment Variables
Create `.env` file in `server/` directory (or use `.env.docker` for Docker):
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate-a-strong-random-secret>
ALLOWED_ORIGINS=https://yourdomain.com
BOOTSTRAP_SUPERADMIN_TOKEN=<random-token-or-omit-to-disable-endpoint>
PAYMOB_HMAC_SECRET=<from-paymob-dashboard>   # required for Paymob callbacks
```

### Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Build for Production
```bash
# Build client
cd client
npm run build

# Start server in production mode
cd ../server
npm start
```

## Security Best Practices

### Passwords
- Minimum 6 characters for users; 12 for the bootstrap super admin
- Stored with bcrypt hashing
- Never logged or exposed in responses

### JWT Tokens
- 7-day expiration in shipped configs (24 h if `JWT_EXPIRES_IN` is unset)
- Stored in `localStorage` under `auth_token` (and duplicated inside the
  persisted `user-storage` Zustand blob) — **httpOnly cookies would be safer**
- Validated on every API request, including a session-token check

### Database
- **Supabase / PostgreSQL — there is no SQLite anywhere in this project**
- Regular backups recommended (see `/api/backup`, which is tenant-scoped)
- Use HTTPS in production

### API
- Authentication required for all data routes; **public exceptions exist**:
  `/api/health`, `/api/banners`, `/api/settings` (public subset only),
  `/api/billing/plans`, and the Paymob webhook
- Input validation on the main write endpoints
- Rate limiting prevents abuse

## Known Limitations

- Tokens in `localStorage` are readable by any XSS payload
- No refresh token mechanism
- No CSRF protection (not currently needed — auth is bearer-token, not cookie)
- No HTTPS enforcement at the app layer (use a reverse proxy like nginx)
- **RLS is bypassed for most queries.** `server/src/db/supabase.js` prefers a
  service-role key, which disables row-level security entirely, so tenant
  isolation depends on every query remembering `.eq('tenant_id', ...)`.
  `setTenantContext()` cannot help: it calls `set_config(..., is_local=true)`
  which is transaction-scoped, but each Supabase HTTP request is its own
  transaction.
- No automated test coverage of the money-critical paths (orders, refunds,
  accounting engine)
- No CI pipeline yet

### Files that must never be run against production

These were removed from the repository during the security audit, but may still
exist in old checkouts or local scratch space:

| File | Why it is dangerous |
|---|---|
| `fix-all-db.sql` | Disables RLS on every table, `GRANT ALL ... TO anon`, and grants a `SECURITY DEFINER` `exec_sql` function to the public `anon` role |
| `fix-fk-cascade.sql` | Rewrites *every* foreign key to `ON DELETE CASCADE`, so deleting a user silently erases their journal entries and audit trail |

If either was ever executed, assume the `anon` key has full database access:
rotate the Supabase anon and service keys, review `pg_policies` and grants, and
re-apply RLS from `server/supabase-schema.sql`.

## Production Recommendations
1. Use HTTPS (Let's Encrypt or cloud provider)
2. Set up nginx reverse proxy (do **not** copy the `proxy_pass http://127.0.0.1:80`
   block from `DEPLOY.md` / `setup.js` — inside a `listen 80` server that loops)
3. Enable database backups
4. Monitor logs for suspicious activity
5. Implement refresh tokens for better UX
6. Move tokens to httpOnly cookies
7. Add a CI pipeline running `npm test` on every push
8. Rotate `RESEND_API_KEY`, `JWT_SECRET`, and the Supabase keys if they were
   ever committed or shared — and add `.dockerignore` (already present) so
   `server/.env` is never baked into an image
