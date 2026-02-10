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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'payment_collected', 'cancelled')),
  payment_method TEXT DEFAULT 'cod' CHECK (payment_method IN ('cod', 'upi_on_delivery')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'collected', 'failed')),
  total_amount DECIMAL(10, 2) NOT NULL,
  delivery_hostel TEXT,
  delivery_room TEXT,
  rider_id UUID REFERENCES public.riders(id),
  delivery_proof_url TEXT,
  delivery_otp TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
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
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'upi_on_delivery')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'collected', 'failed')),
  collected_by UUID REFERENCES public.riders(id),
  collected_at TIMESTAMPTZ,
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
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_payments_payment_status ON public.payments(payment_status);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);
CREATE INDEX idx_payments_collected_by ON public.payments(collected_by);
CREATE INDEX idx_inventory_reservations_product_id ON public.inventory_reservations(product_id);
CREATE INDEX idx_inventory_reservations_user_id ON public.inventory_reservations(user_id);
CREATE INDEX idx_inventory_reservations_order_id ON public.inventory_reservations(order_id);
CREATE INDEX idx_inventory_reservations_expires_at ON public.inventory_reservations(expires_at);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_invitee_id ON public.referrals(invitee_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Products policies
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
CREATE POLICY "Anyone can view riders" ON public.riders
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage riders" ON public.riders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Users can only see their own orders
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

-- Users can see their own order items
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

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = payments.order_id
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

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
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
      AND order_id IS NULL
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
  WHERE expires_at < NOW()
    AND order_id IS NULL;

  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Function to create order + items + reservations atomically
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_items JSONB,
  p_delivery_hostel TEXT,
  p_delivery_room TEXT,
  p_payment_method TEXT DEFAULT 'cod',
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_id UUID;
  v_order_number TEXT;
  v_total NUMERIC := 0;
  v_item RECORD;
  v_price NUMERIC;
  v_is_active BOOLEAN;
  v_drop_id UUID;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '30 minutes';
  v_payment_method TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001';
  END IF;

  v_payment_method := CASE
    WHEN p_payment_method IS NULL OR TRIM(p_payment_method) = '' THEN 'cod'
    WHEN p_payment_method IN ('upi', 'upi_on_delivery') THEN 'upi_on_delivery'
    WHEN p_payment_method = 'cod' THEN 'cod'
    ELSE NULL
  END;

  IF v_payment_method IS NULL THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(TRIM(p_delivery_hostel), '') IS NULL OR NULLIF(TRIM(p_delivery_room), '') IS NULL THEN
    RAISE EXCEPTION 'Delivery address is required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.users
  SET phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      hostel = TRIM(p_delivery_hostel),
      room_number = TRIM(p_delivery_room),
      updated_at = NOW()
  WHERE id = v_user_id;

  SELECT id INTO v_drop_id
  FROM public.drops
  WHERE status = 'live'
  ORDER BY published_at DESC NULLS LAST
  LIMIT 1;

  v_order_number := generate_order_number();

  INSERT INTO public.orders (
    user_id,
    drop_id,
    order_number,
    status,
    payment_method,
    payment_status,
    total_amount,
    delivery_hostel,
    delivery_room
  ) VALUES (
    v_user_id,
    v_drop_id,
    v_order_number,
    'pending',
    v_payment_method,
    'pending',
    0,
    TRIM(p_delivery_hostel),
    TRIM(p_delivery_room)
  ) RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT
      (item->>'productId')::UUID AS product_id,
      SUM((item->>'quantity')::INT)::INT AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid cart item' USING ERRCODE = 'P0001';
    END IF;

    SELECT price, is_active
    INTO v_price, v_is_active
    FROM public.products
    WHERE id = v_item.product_id;

    IF NOT FOUND OR v_is_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Product not available: %', v_item.product_id USING ERRCODE = 'P0001';
    END IF;

    PERFORM reserve_inventory(v_item.product_id, v_item.quantity::INT);

    INSERT INTO public.order_items (order_id, product_id, quantity, price)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_price);

    INSERT INTO public.inventory_reservations (product_id, user_id, order_id, quantity, expires_at)
    VALUES (v_item.product_id, v_user_id, v_order_id, v_item.quantity, v_expires_at);

    v_total := v_total + (v_price * v_item.quantity);
  END LOOP;

  UPDATE public.orders
  SET total_amount = v_total,
      updated_at = NOW()
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_checkout_order(JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Function to collect COD payment and finalize inventory
CREATE OR REPLACE FUNCTION public.process_cod_payment(
  p_order_id UUID,
  p_collected_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_order RECORD;
  v_item RECORD;
  v_payment_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_actor;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order is cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status NOT IN ('delivered', 'payment_collected') THEN
    RAISE EXCEPTION 'Order must be delivered before collecting payment' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.payment_status = 'collected' THEN
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'status', 'payment_collected',
      'already_collected', TRUE
    );
  END IF;

  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.payments (
      order_id,
      amount,
      payment_method,
      payment_status,
      collected_by,
      collected_at
    ) VALUES (
      p_order_id,
      v_order.total_amount,
      v_order.payment_method,
      'collected',
      p_collected_by,
      NOW()
    ) RETURNING id INTO v_payment_id;
  ELSE
    UPDATE public.payments
    SET payment_status = 'collected',
        collected_by = COALESCE(p_collected_by, collected_by),
        collected_at = COALESCE(collected_at, NOW()),
        updated_at = NOW()
    WHERE id = v_payment_id;
  END IF;

  UPDATE public.orders
  SET status = 'payment_collected',
      payment_status = 'collected',
      rider_id = COALESCE(p_collected_by, rider_id),
      updated_at = NOW()
  WHERE id = p_order_id;

  FOR v_item IN
    SELECT product_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    UPDATE public.products
    SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
        reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity)
    WHERE id = v_item.product_id;
  END LOOP;

  DELETE FROM public.inventory_reservations
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'payment_collected'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_cod_payment(UUID, UUID) TO authenticated;

-- Function to cancel COD order and release inventory
CREATE OR REPLACE FUNCTION public.cancel_cod_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_order RECORD;
  v_item RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_actor;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status = 'payment_collected' THEN
    RAISE EXCEPTION 'Order already collected' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'status', 'cancelled',
      'already_cancelled', TRUE
    );
  END IF;

  FOR v_item IN
    SELECT product_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    PERFORM release_inventory(v_item.product_id, v_item.quantity);
  END LOOP;

  DELETE FROM public.inventory_reservations
  WHERE order_id = p_order_id;

  UPDATE public.orders
  SET status = 'cancelled',
      payment_status = CASE
        WHEN payment_status = 'collected' THEN payment_status
        ELSE 'failed'
      END,
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'cancelled'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_cod_order(UUID, TEXT) TO authenticated;

-- Function to get user role (used for admin checks)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-award referral reward on invitee's first qualifying order
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
  -- Only proceed when an order reaches a qualifying completion state
  IF NOT (
    NEW.status = 'payment_collected' OR
    NEW.payment_status = 'collected'
  ) THEN
    RETURN NEW;
  END IF;

  -- Ensure this is the invitee's first qualifying order
  SELECT COUNT(*) INTO v_order_count
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND (
      status = 'payment_collected' OR
      payment_status = 'collected'
    );

  IF v_order_count <> 1 THEN
    RETURN NEW;
  END IF;

  -- Find a pending referral for this invitee
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE invitee_id = NEW.user_id
    AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Use the category of the first order item as the reward category
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
AFTER UPDATE OF status, payment_status ON public.orders
FOR EACH ROW
WHEN (
  (NEW.status = 'payment_collected' AND OLD.status IS DISTINCT FROM NEW.status) OR
  (NEW.payment_status = 'collected' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
)
EXECUTE FUNCTION public.handle_referral_on_order_completion();

