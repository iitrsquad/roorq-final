-- Migration: Ensure order_items insert policy exists
-- Date: 2025-12-09
-- Purpose: Fix "Failed to add item ... to order" caused by missing RLS insert policy

begin;

-- Enable RLS on order_items (no-op if already enabled)
alter table public.order_items enable row level security;

-- Ensure select policy exists (idempotent)
drop policy if exists "Users can view own order items" on public.order_items;
create policy "Users can view own order items"
on public.order_items
for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

-- Ensure insert policy exists (idempotent)
drop policy if exists "Users can insert own order items" on public.order_items;
create policy "Users can insert own order items"
on public.order_items
for insert
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

commit;


