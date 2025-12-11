-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  hostel TEXT,
  room_number TEXT,
  first_cod_done BOOLEAN DEFAULT FALSE,
  referral_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drops table (weekly drops)
CREATE TABLE public.drops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'live', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drop_id UUID REFERENCES public.drops(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('jacket', 'jeans', 'shoes', 'accessories', 'sweater', 't-shirt', 'trousers')),
  gender TEXT DEFAULT 'unisex' CHECK (gender IN ('men', 'women', 'unisex', 'kids')),
  brand TEXT,
  price DECIMAL(10, 2) NOT NULL,
  retail_price DECIMAL(10, 2),
  size TEXT NOT NULL,
  color TEXT,
  material TEXT,
  images TEXT[] DEFAULT '{}',
  stock_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Riders table (moved up to be created before orders)
CREATE TABLE public.riders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  drop_id UUID REFERENCES public.drops(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'placed' CHECK (status IN ('placed', 'reserved', 'packed', 'out_for_delivery', 'delivered', 'cancelled')),
  payment_method TEXT DEFAULT 'cod' CHECK (payment_method IN ('cod', 'upi')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  cod_collected BOOLEAN DEFAULT FALSE,
  total_amount DECIMAL(10, 2) NOT NULL,
  delivery_hostel TEXT,
  delivery_room TEXT,
  rider_id UUID REFERENCES public.riders(id),
  delivery_proof_url TEXT,
  delivery_otp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory reservations (for cart/checkout)
CREATE TABLE public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT NOT NULL,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals table
CREATE TABLE public.referrals (
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

-- Referral rewards (track claimed rewards)
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  category TEXT NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'fulfilled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_drop_id ON public.products(drop_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_gender ON public.products(gender);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_drop_id ON public.orders(drop_id);
CREATE INDEX idx_inventory_reservations_product_id ON public.inventory_reservations(product_id);
CREATE INDEX idx_inventory_reservations_user_id ON public.inventory_reservations(user_id);
CREATE INDEX idx_inventory_reservations_expires_at ON public.inventory_reservations(expires_at);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_invitee_id ON public.referrals(invitee_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Products are public (read-only for non-admins)
CREATE POLICY "Products are viewable by everyone" ON public.products
  FOR SELECT USING (is_active = TRUE);

-- Drops are public (read-only for non-admins)
CREATE POLICY "Drops are viewable by everyone" ON public.drops
  FOR SELECT USING (status IN ('live', 'ended', 'upcoming'));

-- Users can only see their own orders
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can see their own order items
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Users can create inventory reservations for themselves
CREATE POLICY "Users can create own reservations" ON public.inventory_reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reservations" ON public.inventory_reservations
  FOR SELECT USING (auth.uid() = user_id);

-- Referrals policies
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can view own rewards" ON public.referral_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Functions
-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_order_number TEXT;
BEGIN
  new_order_number := 'ROORQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drops_updated_at BEFORE UPDATE ON public.drops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reserve inventory (atomic)
CREATE OR REPLACE FUNCTION reserve_inventory(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  available_stock INTEGER;
BEGIN
  -- Get available stock
  SELECT (stock_quantity - reserved_quantity) INTO available_stock
  FROM public.products
  WHERE id = p_product_id;

  -- Check if enough stock available
  IF available_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', available_stock, p_quantity;
  END IF;

  -- Atomically update reserved quantity
  UPDATE public.products
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = p_product_id
  AND (stock_quantity - reserved_quantity) >= p_quantity;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to reserve inventory';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to release inventory
CREATE OR REPLACE FUNCTION release_inventory(
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

-- Function to clean up expired reservations (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
  released_count INTEGER := 0;
  reservation_record RECORD;
BEGIN
  FOR reservation_record IN
    SELECT * FROM public.inventory_reservations
    WHERE expires_at < NOW()
  LOOP
    -- Release inventory
    PERFORM release_inventory(
      reservation_record.product_id,
      reservation_record.quantity
    );
    
    released_count := released_count + 1;
  END LOOP;

  -- Delete expired reservations
  DELETE FROM public.inventory_reservations
  WHERE expires_at < NOW();

  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user role (used for admin checks)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process payment success atomically (used by Razorpay webhooks)
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
  -- 1. Check if Order exists and lock it
  SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- 2. Check for Idempotency (if payment already recorded)
  SELECT EXISTS(SELECT 1 FROM public.payments WHERE transaction_id = p_transaction_id) INTO v_payment_exists;
  
  IF v_payment_exists THEN
     -- Already processed, just return success
     RETURN jsonb_build_object('success', true, 'message', 'Payment already processed');
  END IF;

  -- 3. Update Order Status
  IF v_order_record.payment_status != 'paid' THEN
    UPDATE public.orders
    SET status = CASE WHEN status = 'reserved' THEN 'placed' ELSE status END,
        payment_status = 'paid',
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  -- 4. Insert Payment Record
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
    'completed',
    NOW()
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
