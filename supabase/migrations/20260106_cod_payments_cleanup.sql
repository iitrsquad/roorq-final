-- Migration: COD-only payments schema cleanup and order status alignment
BEGIN;

-- Remove online-payment transitions and functions
DROP TRIGGER IF EXISTS validate_payment_status_change ON public.payments;
DROP FUNCTION IF EXISTS public.check_payment_status_transition();
DROP FUNCTION IF EXISTS public.process_payment_success(UUID, TEXT, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.process_payment_success(UUID, TEXT, NUMERIC, TEXT);

-- Update payments table for COD-only model
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.payments
  ALTER COLUMN status TYPE TEXT USING status::text;

ALTER TABLE public.payments
  RENAME COLUMN status TO payment_status;

ALTER TABLE public.payments
  RENAME COLUMN method TO payment_method;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS transaction_id;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES public.riders(id),
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

UPDATE public.payments
SET payment_method = CASE
  WHEN payment_method = 'upi' THEN 'upi_on_delivery'
  WHEN payment_method IS NULL OR payment_method = '' THEN 'cod'
  ELSE payment_method
END;

UPDATE public.payments
SET payment_status = CASE
  WHEN payment_status IN ('success', 'paid', 'collected') THEN 'collected'
  WHEN payment_status = 'processing' THEN 'pending'
  WHEN payment_status = 'refunded' THEN 'failed'
  WHEN payment_status IS NULL OR payment_status = '' THEN 'pending'
  ELSE payment_status
END;

ALTER TABLE public.payments
  ALTER COLUMN payment_method SET DEFAULT 'cod',
  ALTER COLUMN payment_status SET DEFAULT 'pending';

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('cod', 'upi_on_delivery')),
  ADD CONSTRAINT payments_payment_status_check CHECK (payment_status IN ('pending', 'collected', 'failed'));

DROP TYPE IF EXISTS public.payment_status_enum;

DROP INDEX IF EXISTS idx_payments_transaction_id;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_payments_payment_status;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON public.payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_collected_by ON public.payments(collected_by);

-- Update orders table for COD workflow
DROP TRIGGER IF EXISTS trigger_referral_on_order_completion ON public.orders;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  DROP CONSTRAINT IF EXISTS orders_payment_method_check,
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

UPDATE public.orders
SET status = CASE
  WHEN status IN ('placed', 'reserved') THEN 'pending'
  WHEN status = 'packed' THEN 'confirmed'
  ELSE status
END;

UPDATE public.orders
SET payment_method = CASE
  WHEN payment_method = 'upi' THEN 'upi_on_delivery'
  WHEN payment_method IS NULL OR payment_method = '' THEN 'cod'
  ELSE payment_method
END;

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_status IN ('paid', 'success', 'collected') THEN 'collected'
  WHEN payment_status = 'refunded' THEN 'failed'
  WHEN payment_status IS NULL OR payment_status = '' THEN 'pending'
  ELSE payment_status
END;

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN payment_method SET DEFAULT 'cod',
  ALTER COLUMN payment_status SET DEFAULT 'pending';

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'payment_collected', 'cancelled')),
  ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod', 'upi_on_delivery')),
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'collected', 'failed'));

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS cod_collected;

-- Update checkout function for COD statuses and payment methods
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
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '10 minutes';
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

    INSERT INTO public.inventory_reservations (product_id, user_id, quantity, expires_at)
    VALUES (v_item.product_id, v_user_id, v_item.quantity, v_expires_at);

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

-- Update referral reward trigger for COD collection states
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
    NEW.status = 'payment_collected' OR
    NEW.payment_status = 'collected'
  ) THEN
    RETURN NEW;
  END IF;

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

CREATE TRIGGER trigger_referral_on_order_completion
AFTER UPDATE OF status, payment_status ON public.orders
FOR EACH ROW
WHEN (
  (NEW.status = 'payment_collected' AND OLD.status IS DISTINCT FROM NEW.status) OR
  (NEW.payment_status = 'collected' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
)
EXECUTE FUNCTION public.handle_referral_on_order_completion();

COMMIT;
