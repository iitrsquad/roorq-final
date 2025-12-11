-- Migration: Fix RLS Policies and Schema Gaps
-- Date: 2024-05-23
-- Description: Adds 'gender' to products, fixes RLS for orders/referrals to prevent 403/404s

BEGIN;

-- 1. Add Gender Column to Products (Fixes 404/400 if filtered by gender)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'unisex' CHECK (gender IN ('men', 'women', 'unisex', 'kids'));

CREATE INDEX IF NOT EXISTS idx_products_gender ON public.products(gender);

-- 2. Fix RLS Policies for Orders (Fixes 403 Forbidden)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Fix RLS Policies for Order Items (Fixes 403 when viewing order details)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Allow users to insert order items for their own orders
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
CREATE POLICY "Users can insert own order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- 4. Fix RLS for Referrals (Fixes 403 on Referrals Page)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" 
ON public.referrals 
FOR SELECT 
USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

-- 5. Fix RLS for Referral Rewards (Fixes 403 on Referrals Page)
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rewards" ON public.referral_rewards;
CREATE POLICY "Users can view own rewards" 
ON public.referral_rewards 
FOR SELECT 
USING (auth.uid() = user_id);

COMMIT;



