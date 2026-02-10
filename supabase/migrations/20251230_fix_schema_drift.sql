-- Migration: Fix schema drift and align payments enum, RLS, and admin policies
-- Date: 2025-12-30
-- Description: Brings schema.sql and migrations into a consistent state.

BEGIN;

-- Ensure payment_status_enum exists
DO $$ BEGIN
    CREATE TYPE public.payment_status_enum AS ENUM ('pending', 'processing', 'success', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Normalize legacy values before altering column type
UPDATE public.payments
SET status = 'success'
WHERE status = 'completed';

-- Ensure payments.status uses enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'status'
      AND udt_name <> 'payment_status_enum'
  ) THEN
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE public.payments
      ALTER COLUMN status TYPE public.payment_status_enum
      USING status::text::public.payment_status_enum;
  END IF;
END $$;

ALTER TABLE public.payments
  ALTER COLUMN status SET DEFAULT 'pending'::public.payment_status_enum;

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = payments.order_id
      AND orders.user_id = auth.uid()
  )
);

-- Payment status transition function/trigger
CREATE OR REPLACE FUNCTION check_payment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow initial insert
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Allow no change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states
  IF OLD.status = 'failed' THEN
     RAISE EXCEPTION 'Payment is already FAILED and cannot be modified';
  END IF;

  -- Valid transitions
  IF OLD.status = 'pending' AND NEW.status NOT IN ('processing', 'success', 'failed') THEN
     RAISE EXCEPTION 'Invalid payment transition: pending -> %', NEW.status;
  END IF;

  IF OLD.status = 'processing' AND NEW.status NOT IN ('success', 'failed') THEN
     RAISE EXCEPTION 'Invalid payment transition: processing -> %', NEW.status;
  END IF;

  IF OLD.status = 'success' AND NEW.status NOT IN ('refunded') THEN
     RAISE EXCEPTION 'Invalid payment transition: success -> %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_payment_status_change ON public.payments;
CREATE TRIGGER validate_payment_status_change
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_status_transition();

-- updated_at trigger for payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Align process_payment_success to enum status
CREATE OR REPLACE FUNCTION public.process_payment_success(
  p_order_id UUID,
  p_transaction_id TEXT,
  p_amount DECIMAL,
  p_method TEXT
) RETURNS JSONB AS $$
DECLARE
  v_order_record public.orders%ROWTYPE;
  v_payment_exists BOOLEAN;
BEGIN
  SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.payments WHERE transaction_id = p_transaction_id) INTO v_payment_exists;

  IF v_payment_exists THEN
     RETURN jsonb_build_object('success', true, 'message', 'Payment already processed');
  END IF;

  IF v_order_record.payment_status != 'paid' THEN
    UPDATE public.orders
    SET status = CASE WHEN status = 'reserved' THEN 'placed' ELSE status END,
        payment_status = 'paid',
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  INSERT INTO public.payments (
    order_id,
    transaction_id,
    amount,
    method,
    status,
    created_at
  ) VALUES (
    p_order_id,
    p_transaction_id,
    p_amount,
    p_method,
    'success',
    NOW()
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS on riders
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

-- Products policies
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Anyone can view active products" ON public.products
FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can view all products" ON public.products
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can insert products" ON public.products
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update products" ON public.products
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete products" ON public.products
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Drops policies
DROP POLICY IF EXISTS "Drops are viewable by everyone" ON public.drops;
DROP POLICY IF EXISTS "Anyone can view published drops" ON public.drops;
DROP POLICY IF EXISTS "Admins can view all drops" ON public.drops;
DROP POLICY IF EXISTS "Admins can manage drops" ON public.drops;

CREATE POLICY "Anyone can view published drops" ON public.drops
FOR SELECT USING (status IN ('live', 'ended', 'upcoming'));

CREATE POLICY "Admins can view all drops" ON public.drops
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can manage drops" ON public.drops
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Riders policies
DROP POLICY IF EXISTS "Anyone can view riders" ON public.riders;
DROP POLICY IF EXISTS "Admins can manage riders" ON public.riders;

CREATE POLICY "Anyone can view riders" ON public.riders
FOR SELECT USING (true);

CREATE POLICY "Admins can manage riders" ON public.riders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Orders policies
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;

CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON public.orders
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders" ON public.orders
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Order items policies
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

CREATE POLICY "Users can view own order items" ON public.order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own order items" ON public.order_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all order items" ON public.order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Users admin policy
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
FOR SELECT USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Referral reward trigger
CREATE OR REPLACE FUNCTION public.handle_referral_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_category TEXT;
  v_order_count INTEGER;
  v_reward_exists BOOLEAN;
BEGIN
  IF NOT (
    NEW.status IN ('placed', 'packed', 'out_for_delivery', 'delivered') OR
    NEW.payment_status = 'paid' OR
    NEW.cod_collected IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_order_count
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND (
      status IN ('placed', 'packed', 'out_for_delivery', 'delivered') OR
      payment_status = 'paid' OR
      cod_collected IS TRUE
    );

  IF v_order_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_referral
  FROM public.referrals
  WHERE invitee_id = NEW.user_id
    AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT p.category INTO v_category
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
  LIMIT 1;

  IF v_category IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.referrals
  SET status = 'eligible',
      reward_category = v_category,
      invitee_first_order_id = NEW.id,
      updated_at = NOW()
  WHERE id = v_referral.id;

  SELECT EXISTS (
    SELECT 1
    FROM public.referral_rewards
    WHERE referral_id = v_referral.id
  ) INTO v_reward_exists;

  IF NOT v_reward_exists THEN
    INSERT INTO public.referral_rewards (
      referral_id,
      user_id,
      category,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_referral.id,
      v_referral.referrer_id,
      v_category,
      'available',
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_referral_on_order_completion ON public.orders;

CREATE TRIGGER trigger_referral_on_order_completion
AFTER UPDATE OF status, payment_status, cod_collected ON public.orders
FOR EACH ROW
WHEN (
  (NEW.status IN ('placed', 'packed', 'out_for_delivery', 'delivered') AND OLD.status IS DISTINCT FROM NEW.status) OR
  (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status) OR
  (NEW.cod_collected IS TRUE AND OLD.cod_collected IS DISTINCT FROM NEW.cod_collected)
)
EXECUTE FUNCTION public.handle_referral_on_order_completion();

COMMIT;

-- Down (manual rollback)
-- BEGIN;
-- UPDATE public.payments SET status = 'completed' WHERE status = 'success';
-- UPDATE public.payments SET status = 'pending' WHERE status = 'processing';
-- ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
-- ALTER TABLE public.payments
--   ALTER COLUMN status TYPE TEXT
--   USING status::text;
-- ALTER TABLE public.payments
--   ALTER COLUMN status SET DEFAULT 'pending';
-- ALTER TABLE public.payments
--   ADD CONSTRAINT payments_status_check
--   CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
-- DROP TRIGGER IF EXISTS validate_payment_status_change ON public.payments;
-- DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
-- DROP FUNCTION IF EXISTS check_payment_status_transition();
-- DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
-- DROP TYPE IF EXISTS public.payment_status_enum;
-- DROP TRIGGER IF EXISTS trigger_referral_on_order_completion ON public.orders;
-- DROP FUNCTION IF EXISTS public.handle_referral_on_order_completion();
-- COMMIT;
