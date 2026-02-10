BEGIN;

-- Ensure referral code exists for all users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

UPDATE public.users
SET referral_code = gen_random_uuid()::TEXT
WHERE referral_code IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_referral_code_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

ALTER TABLE public.users
  ALTER COLUMN referral_code SET DEFAULT gen_random_uuid()::TEXT;

ALTER TABLE public.users
  ALTER COLUMN referral_code SET NOT NULL;

-- Ensure users can read/update their own profile
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Referrals tables (if missing)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'claimed', 'fulfilled')),
  reward_category TEXT,
  reward_product_id UUID REFERENCES public.products(id),
  invitee_first_order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, invitee_id)
);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  category TEXT NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'fulfilled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_invitee_id ON public.referrals(invitee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON public.referral_rewards(user_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

DROP POLICY IF EXISTS "Users can view own rewards" ON public.referral_rewards;
CREATE POLICY "Users can view own rewards" ON public.referral_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Core helpers used across the app
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_order_number TEXT;
BEGIN
  new_order_number := 'ROORQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  available_stock INTEGER;
BEGIN
  SELECT (stock_quantity - reserved_quantity) INTO available_stock
  FROM public.products
  WHERE id = p_product_id;

  IF available_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', available_stock, p_quantity;
  END IF;

  UPDATE public.products
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = p_product_id
    AND (stock_quantity - reserved_quantity) >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to reserve inventory';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.release_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.products
  SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity)
  WHERE id = p_product_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Role helper used by client/admin checks
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() <> user_id THEN
    SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
    IF caller_role NOT IN ('admin', 'super_admin') THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN (SELECT role FROM public.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;

COMMIT;
