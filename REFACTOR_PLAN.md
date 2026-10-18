# Dukkanza — Structural Refactor Plan

Status: **proposed** · Compiled: 2026-10-19 · Scope: pure structure (zero behavior change)

This plan follows the stale-reference sweep (commit history) and is the
"structural" half of the agreed *sweep + plan* scope. Nothing here executes
until each phase is explicitly approved.

---

## 1. Goals

1. Shrink oversized files into cohesive, single-purpose modules.
2. Give the flat 45-page client directory domain structure.
3. Keep production green after **every** commit (full gates, no exceptions).
4. Use GitNexus `impact`/`rename` for every symbol move — never find-and-replace.

## 2. Current state (measured 2026-10-19)

| Area | Count | Largest offenders |
|---|---|---|
| Client pages | 45 (flat dir) | SuperAdminPage 68 KB · POSPage 48 KB · LandingPage 35 KB · PricingPage 34 KB · BranchesPage 28 KB |
| Client components | 25 | — |
| Client stores / lib / tests | 6 / 12 / 9 | — |
| Server routes | 44 | paymob 31 KB · superAdmin 31 KB · auth 26 KB · attendance 24 KB · commissions 20 KB |
| Server services | 21 | accountingEngine 28 KB |
| Server tests | 14 files, **169 tests** | the safety net |
| Client tests | 9 files, **77 tests** | the safety net |

Hotspot pattern: *route files absorb everything* (validation + orchestration +
response shaping + business rules), and *pages absorb entire feature UIs*.

## 3. Target structure

### Server — split the giants, keep URLs frozen

```
server/src/routes/
  superAdmin/            ← from superAdmin.js (31 KB)
    index.js             router assembly (paths unchanged)
    billing.js  wallet.js  plans.js  tenants.js
  paymob/                ← from paymob.js (31 KB)
    index.js  initiate.js  webhook.js  callbacks.js
  auth/                  ← from auth.js (26 KB)
    index.js  login.js  register.js  passwordReset.js
  attendance/            ← from attendance.js (24 KB)
    index.js  clock.js  scheduling.js
```

Rules:
- **Every existing URL stays byte-identical** — the Paymob callback URL is
  registered with Paymob; Vercel rewrites `/api/*` to Fly. Path moves are
  forbidden.
- Route modules keep using the existing middleware/validation patterns
  (`express-validator`, auth middleware) — extraction only, no rewrites.
- `services/` stays the business-logic layer; routes shrink toward
  parse → call service → shape response.

### Client — domain-grouped pages, then colocation

```
client/src/pages/
  pos/            POSPage, CashShiftPage, RefundsPage, PaymentsPage
  inventory/      InventoryPage, PurchaseOrdersPage, SuppliersPage,
                  Products… , DeadStockReport, Stock…
  accounting/     JournalEntriesPage, ChartOfAccountsPage,
                  AccountingReportsPage, ExpensesPage, InvoicesPage
  hr/             Attendance*, Employees, Payroll, Leave*,
                  ShiftScheduling, PerformanceReviews, Commissions
  reports/        ReportsPage, DashboardPage(+), Activities
  billing/        BillingPage, PricingPage, ServicePlansPage,
                  SubscriptionsPage, SuperAdminPage
  auth/           Login, Signup, ForgotPassword, ResetPassword, Profile
  marketing/      LandingPage, PromotionsPage, ServicesPage
  settings/       SettingsPage, BranchesPage, UsersPage, BackupPage, ChatPage
```

- First move: **subfolders only** (import-path updates are mechanical; eslint +
  build prove completeness). Component colocation (`Page/components/`) is an
  optional follow-up per group.
- `App.jsx` route table imports are the single source of churn — do it with
  GitNexus `rename`, one group per commit.

## 4. Phases

| Phase | Work | Risk | Gate extras |
|---|---|---|---|
| **P0** ✅ | Stale-reference sweep | low | done |
| **P1** | Server: split top-4 route giants (paymob, superAdmin, auth, attendance) | **med** — touched files are payment/auth critical | supertest 169+ must stay green; boot smoke; Fly deploy + webhook smoke |
| **P2** | Client: pages into domain subfolders (mechanical imports) | low-med | eslint 0/0, vitest 77+, build; Vercel preview check |
| **P3** | Client: colocate page-private components; delete unused ones (`unused-imports` plugin is active) | low | same as P2 |
| **P4** | Server: split `accountingEngine.js` (28 KB) + remaining routes >15 KB | med | 169+ tests, accounting seed smoke |
| **P5** *(optional, decision-gated)* | API response envelope unification via client `api.js` adapter | **high** — touches every route; deferred unless pain justifies | only with explicit approval + contract tests first |

Each phase = one commit (or small series), gates green, `detect_changes`
reviewed, Fly deploy only for server phases.

## 5. Risk register

| Risk | Mitigation |
|---|---|
| Route URL drift (Paymob callback, Vercel rewrite) | URL freeze rule; supertest asserts paths; grep `/api/` consumers |
| Missed import after a move | eslint + `unused-imports` + production build fail loudly |
| Hidden dynamic requires/`import()` paths | pre-move grep for `import(` with variable paths |
| Workbox/PWA cache serving stale bundles | index.html revision handles it (already proven in rename phases) |
| Offline data orphaning | **never** rename `store-management-offline` IndexedDB or other runtime identifiers |
| GitNexus index drift after moves | re-run `node .gitnexus/run.cjs analyze` at each phase end |

## 6. Explicit non-goals

- No UX/behavior changes anywhere — structure only.
- No theme retheme (separate open decision).
- No Fly app rename, no GitHub repo rename (frozen decisions).
- No package/dependency upgrades bundled into refactor phases.
- No deletion of the intentional Receive Stock endpoint or other
  previously-decided product behaviors.

## 7. Effort estimate

- **P1**: one focused session (mechanical extraction, tests as railings)
- **P2**: one session (45 files, scripted + verified)
- **P3**: half session
- **P4**: one session
- **P5**: only if approved — separate design doc first

## 8. Approval

Reply with the phase number to start (recommended order: **P1 → P2 → P3 → P4**),
or "P1" to pilot the riskiest-value-first slice and reassess after.
