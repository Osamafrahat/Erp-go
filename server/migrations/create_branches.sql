-- Multi-branch / multi-warehouse foundation
-- APPLIED to production via Supabase on 2026-10-14 (migrations
-- "multi_branch_foundation" + "product_stock_updated_at_and_fn_fix" +
-- "execute_stock_transfer_fn"); kept as the record of what runs. Verified
-- after apply:
--   * one default "Main Branch" per existing tenant,
--   * 0 unstamped rows on orders/cash_shifts/expenses/employees/
--     purchase_orders (only 2 tenant-less seed stock_movements remain
--     NULL — they have no tenant, so no branch can apply),
--   * product_stock seeded from products.stock_quantity,
--   * adjust_product_stock(): returns new branch qty, recomputes the
--     product TOTAL from branch rows (tested forward and restored),
--   * execute_stock_transfer(): moved 1 unit between branches mid-txn,
--     BRANCH_SAME raised with full rollback and zero residue; EXECUTE
--     granted to service_role only.

create table if not exists public.branches (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  name text not null,
  code text,
  type text not null default 'store' check (type in ('store','warehouse')),
  address text,
  phone text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists branches_tenant_name_key on public.branches(tenant_id, name);
create unique index if not exists branches_one_default_key on public.branches(tenant_id) where is_default;
create index if not exists branches_tenant_idx on public.branches(tenant_id);

alter table public.users add column if not exists branch_id bigint references public.branches(id);

alter table public.orders add column if not exists branch_id bigint references public.branches(id);
alter table public.cash_shifts add column if not exists branch_id bigint references public.branches(id);
alter table public.expenses add column if not exists branch_id bigint references public.branches(id);
alter table public.employees add column if not exists branch_id bigint references public.branches(id);
alter table public.purchase_orders add column if not exists branch_id bigint references public.branches(id);
alter table public.stock_movements add column if not exists branch_id bigint references public.branches(id);

create table if not exists public.product_stock (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  branch_id bigint not null references public.branches(id) on delete cascade,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint product_stock_qty_nonneg check (quantity >= 0),
  constraint product_stock_unique unique (product_id, branch_id)
);
create index if not exists product_stock_tenant_branch_idx on public.product_stock(tenant_id, branch_id);

create table if not exists public.stock_transfers (
  id bigint generated always as identity primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  from_branch_id bigint not null references public.branches(id),
  to_branch_id bigint not null references public.branches(id),
  status text not null default 'completed' check (status in ('completed','pending','cancelled')),
  notes text,
  created_by bigint references public.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint stock_transfers_distinct check (from_branch_id <> to_branch_id)
);
create table if not exists public.stock_transfer_items (
  id bigint generated always as identity primary key,
  transfer_id bigint not null references public.stock_transfers(id) on delete cascade,
  product_id bigint not null references public.products(id),
  quantity numeric not null check (quantity > 0)
);
create index if not exists stock_transfers_tenant_idx on public.stock_transfers(tenant_id, created_at desc);

-- Atomic branch-stock adjust + total recompute (server-side only:
-- EXECUTE revoked from public/anon/authenticated, granted to service_role).
create or replace function public.adjust_product_stock(
  p_tenant_id bigint, p_product_id bigint, p_branch_id bigint, p_delta numeric
) returns numeric
language plpgsql
as $$
declare
  v_qty numeric;
begin
  insert into public.product_stock (tenant_id, product_id, branch_id, quantity, updated_at)
  values (p_tenant_id, p_product_id, p_branch_id, greatest(coalesce(p_delta, 0), 0), now())
  on conflict (product_id, branch_id)
  do update set quantity = greatest(0, product_stock.quantity + coalesce(p_delta, 0)),
                updated_at = now()
  returning quantity into v_qty;

  update public.products
     set stock_quantity = coalesce(
           (select sum(ps.quantity) from public.product_stock ps where ps.product_id = p_product_id), 0),
         updated_at = now()
   where id = p_product_id and tenant_id = p_tenant_id;

  return v_qty;
end;
$$;
revoke execute on function public.adjust_product_stock(bigint, bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function public.adjust_product_stock(bigint, bigint, bigint, numeric) to service_role;

-- Atomic stock transfer: one transaction, all-or-nothing. Locks the
-- source product_stock row FOR UPDATE so two concurrent transfers can
-- never both spend the same unit; raises BRANCH_SAME / BRANCH_EMPTY /
-- BRANCH_INVALID / STOCK_INSUFFICIENT, which the API maps to 400s.
-- (definition read back from prod via pg_get_functiondef after apply —
-- this is byte-for-byte what runs there.)
create or replace function public.execute_stock_transfer(
  p_tenant_id bigint, p_from bigint, p_to bigint, p_items jsonb, p_notes text, p_user_id bigint
) returns bigint
language plpgsql
as $function$
declare
  v_id bigint;
  v_item jsonb;
  v_pid bigint;
  v_qty numeric;
  v_avail numeric;
begin
  if p_from is null or p_to is null then
    raise exception 'BRANCH_INVALID';
  end if;
  if p_from = p_to then
    raise exception 'BRANCH_SAME';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'BRANCH_EMPTY';
  end if;

  insert into public.stock_transfers
    (tenant_id, from_branch_id, to_branch_id, status, notes, created_by, completed_at)
  values
    (p_tenant_id, p_from, p_to, 'completed', p_notes, p_user_id, now())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::numeric;

    if v_pid is null or v_qty is null or v_qty <= 0 then
      raise exception 'BRANCH_INVALID';
    end if;

    select quantity into v_avail
      from public.product_stock
     where product_id = v_pid and branch_id = p_from
       for update;

    if coalesce(v_avail, 0) < v_qty then
      raise exception 'STOCK_INSUFFICIENT';
    end if;

    insert into public.stock_transfer_items (transfer_id, product_id, quantity)
    values (v_id, v_pid, v_qty);

    perform public.adjust_product_stock(p_tenant_id, v_pid, p_from, -v_qty);
    perform public.adjust_product_stock(p_tenant_id, v_pid, p_to,  v_qty);

    insert into public.stock_movements
      (tenant_id, product_id, type, quantity, reference_id, notes, created_by, branch_id)
    values
      (p_tenant_id, v_pid, 'transfer_out', -v_qty, v_id,
       'Transfer #' || v_id || ' out', coalesce(p_user_id::text, 'system'), p_from);

    insert into public.stock_movements
      (tenant_id, product_id, type, quantity, reference_id, notes, created_by, branch_id)
    values
      (p_tenant_id, v_pid, 'transfer_in', v_qty, v_id,
       'Transfer #' || v_id || ' in', coalesce(p_user_id::text, 'system'), p_to);
  end loop;

  return v_id;
end;
$function$;
revoke execute on function public.execute_stock_transfer(bigint, bigint, bigint, jsonb, text, bigint) from public, anon, authenticated;
grant execute on function public.execute_stock_transfer(bigint, bigint, bigint, jsonb, text, bigint) to service_role;

-- Deny-all posture on the new tables (RLS on, no policies, no anon/
-- authenticated grants).
alter table public.branches enable row level security;
alter table public.product_stock enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
revoke all on public.branches from anon, authenticated;
revoke all on public.product_stock from anon, authenticated;
revoke all on public.stock_transfers from anon, authenticated;
revoke all on public.stock_transfer_items from anon, authenticated;

-- Backfill (one-time; recorded above for the applied run):
-- insert default branches; stamp branch_id on operational rows; seed
-- product_stock from products.stock_quantity.
