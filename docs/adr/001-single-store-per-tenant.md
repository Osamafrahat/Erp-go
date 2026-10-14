# ADR-001: Single Store Per Tenant

- **Status:** Accepted
- **Date:** 2026-10-14
- **Deciders:** Product

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
