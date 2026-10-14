# ADR-001: Single Store Per Tenant

- **Status:** Superseded — decision reversed the same day; multi-branch shipped
  (see Outcome). Kept as the record of the original constraint.
- **Date:** 2026-10-14
- **Deciders:** Product

## Outcome (2026-10-14) — reversed, Phases 1–3 shipped

Multi-branch/multi-warehouse was built end-to-end, following the migration
plan below with four deliberate deviations:

1. **`products` stays tenant-shared** — no `branch_id` FK on products. The
   per-branch quantity lives in `product_stock (product_id, branch_id,
   quantity)`; `products.stock_quantity` remains a cached TOTAL recomputed by
   the `adjust_product_stock()` SQL function, so `total = sum(branches)` holds
   by construction and every legacy reader of the total stays correct.
2. **Scoping is explicit query filters, not RLS predicates** — the server uses
   the service key (bypasses RLS), so `setTenantContext` resolves an effective
   branch (header for MANAGER/SUPER_ADMIN, pinned `users.branch_id`, else the
   tenant default) and handlers filter by `req.branchId`. New tables are RLS
   deny-all with anon/authenticated revoked.
3. **Backfill chose explicit "Main Branch" rows**, not NULL-as-whole-tenant:
   every tenant got one default branch and all existing operational rows were
   stamped (the ambiguity flagged in Phase 1 was resolved that way).
4. **Per-branch plan limits (Phase 3) did not ship** — limits stay tenant-level.

Shipped: `branches` table (store/warehouse types, one default per tenant),
branch switcher + management page, atomic inter-branch transfers
(`execute_stock_transfer()`, all-or-nothing with FOR UPDATE row locks),
branch-scoped orders/shifts/expenses/stock movements/reports/refunds, and
optional `branch_id` on employees, users, and purchase orders. Schema record:
`server/migrations/create_branches.sql`.

## Context

Every tenant in Erp-go maps to exactly one store. Products, inventory, orders,
cash shifts, employees, and expenses are scoped only by `tenant_id`; there is
no `branches` table and no `branch_id` column anywhere in the schema.

This is the ceiling on moving upmarket to retail chains — the biggest product
decision looming. Chains (multi-branch supermarkets, franchise networks,
distributors with warehouses) cannot be represented: they would have to create
one tenant per branch, which fragments reporting, inventory transfers, and
billing.

## Decision

**Stay single-store-per-tenant for now.** Multi-branch/multi-warehouse is
explicitly out of scope until a chain opportunity justifies the cost.

## Consequences

- All current code, RLS posture, plan limits, and backups remain
  tenant-scoped and branch-agnostic. No schema churn.
- Every new table or query written in the meantime must keep working if a
  nullable `branch_id` is introduced later: scope by `tenant_id`, never assume
  a tenant's rows are globally unique per business entity, and avoid
  hard-coding "one cash shift / one inventory per tenant" invariants in new
  features.
- Chain customers must be declined or served with separate tenants until a
  migration is funded.

## Migration plan if/when reversed

Reversing this decision is a schema + product project, not a config change.
The intended shape:

1. **Phase 1 — groundwork (non-breaking):**
   - Add `branches (id, tenant_id, name, is_active)` unique on `(tenant_id, name)`.
   - Add nullable `branch_id` FK to `products`, `inventory`, `orders`,
     `cash_shifts`, `expenses`, `employees` (+ any table that gains business
     meaning per branch). Nullable = existing rows are "main branch".
   - Backfill each tenant with a single `Main Branch` row and set `branch_id`
     on all existing rows, **or** leave `branch_id` NULL meaning "whole
     tenant" — this backfill semantic must be decided *before* writing the
     migration (NULL-as-main vs explicit main row changes every scope filter
     later).
2. **Phase 2 — scoping:** thread `branch_id` through queries behind
   `setTenantContext(tenant_id, branch_id)`; RLS policies gain a `branch_id`
   predicate. Old NULL reads must keep working during rollout.
3. **Phase 3 — product:** branch switcher (MANAGER+), per-branch plan limits,
   inter-branch stock transfers, per-branch reports, warehouse vs store
   branch types.

Phases are independently shippable; Phase 1 alone is safe and reversible.

## Alternatives considered

- **Multi-tenant-per-branch (separate tenants per store):** already possible
  today, but fragments billing, cross-store reporting, and stock transfers.
  Rejected as a long-term model; acceptable only as a stopgap for a real
  chain customer.
- **Build multi-branch now:** schema churn across the hottest paths (POS,
  orders, stock) with zero current demand. Rejected — cost ahead of revenue.
