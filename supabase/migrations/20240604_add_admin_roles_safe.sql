-- Migration: Add Admin Role System (SAFE VERSION - handles existing policies)
-- This version automatically drops all existing policies before creating new ones

BEGIN;

-- 1. Add role column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' 
CHECK (role IN ('customer', 'admin', 'super_admin'));

-- 2. Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 3. Set initial super_admin
UPDATE public.users 
SET role = 'super_admin' 
WHERE email = 'nenavathharish02@gmail.com';

-- 4. Enable RLS on riders table (if not already)
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

-- 5. Drop ALL existing policies automatically
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on products
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', r.policyname);
    END LOOP;
    
    -- Drop all policies on orders
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', r.policyname);
    END LOOP;
    
    -- Drop all policies on riders
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'riders') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.riders', r.policyname);
    END LOOP;
    
    -- Drop all policies on drops
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drops') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.drops', r.policyname);
    END LOOP;
    
    -- Drop all policies on order_items
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', r.policyname);
    END LOOP;
    
    -- Drop admin policies on users (keep user profile policies)
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname LIKE '%admin%') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', r.policyname);
    END LOOP;
END $$;

-- 6. Products Policies
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 7. Orders Policies
CREATE POLICY "Users can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 8. Riders Policies
CREATE POLICY "Anyone can view riders"
ON public.riders FOR SELECT
USING (true);

CREATE POLICY "Admins can manage riders"
ON public.riders FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 9. Drops Policies
CREATE POLICY "Anyone can view published drops"
ON public.drops FOR SELECT
USING (status IN ('live', 'ended', 'upcoming'));

CREATE POLICY "Admins can view all drops"
ON public.drops FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can manage drops"
ON public.drops FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 10. Order Items Policies
CREATE POLICY "Users can view own order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- 11. Users - Admins can view all users
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

COMMIT;

