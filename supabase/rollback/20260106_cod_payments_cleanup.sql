-- Rollback: restore pre-COD payments schema and Razorpay-era functions
BEGIN;

DO $$
BEGIN
  CREATE TYPE public.payment_status_enum AS ENUM ('pending', 'processing', 'success', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check,
  DROP CONSTRAINT IF EXISTS payments_payment_status_check;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS collected_by,
  DROP COLUMN IF EXISTS collected_at;

UPDATE public.payments
SET payment_method = CASE
  WHEN payment_method = 'upi_on_delivery' THEN 'upi'
  WHEN payment_method IS NULL OR payment_method = '' THEN 'cod'
  ELSE payment_method
END;

UPDATE public.payments
SET payment_status = CASE
  WHEN payment_status = 'collected' THEN 'success'
  WHEN payment_status = 'failed' THEN 'failed'
  WHEN payment_status = 'pending' THEN 'pending'
  ELSE payment_status
END;

ALTER TABLE public.payments
  RENAME COLUMN payment_method TO method;

ALTER TABLE public.payments
  RENAME COLUMN payment_status TO status;

ALTER TABLE public.payments
  ALTER COLUMN status TYPE public.payment_status_enum USING status::text::public.payment_status_enum;

ALTER TABLE public.payments
  ALTER COLUMN status SET DEFAULT 'pending'::public.payment_status_enum;

DROP INDEX IF EXISTS idx_payments_payment_status;
DROP INDEX IF EXISTS idx_payments_collected_by;
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  DROP CONSTRAINT IF EXISTS orders_payment_method_check,
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cod_collected BOOLEAN DEFAULT FALSE;

UPDATE public.orders
SET status = CASE
  WHEN status = 'pending' THEN 'placed'
  WHEN status = 'confirmed' THEN 'packed'
  WHEN status = 'payment_collected' THEN 'delivered'
  ELSE status
END;

UPDATE public.orders
SET payment_method = CASE
  WHEN payment_method = 'upi_on_delivery' THEN 'upi'
  WHEN payment_method IS NULL OR payment_method = '' THEN 'cod'
  ELSE payment_method
END;

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_status = 'collected' THEN 'paid'
  WHEN payment_status = 'failed' THEN 'failed'
  WHEN payment_status = 'pending' THEN 'pending'
  ELSE payment_status
END;

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'placed',
  ALTER COLUMN payment_method SET DEFAULT 'cod',
  ALTER COLUMN payment_status SET DEFAULT 'pending';

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (status IN ('placed', 'reserved', 'packed', 'out_for_delivery', 'delivered', 'cancelled')),
  ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod', 'upi')),
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

CREATE OR REPLACE FUNCTION check_payment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'failed' THEN
     RAISE EXCEPTION 'Payment is already FAILED and cannot be modified';
  END IF;

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
CREATE TRIGGER validate_payment_status_change BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_status_transition();

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001';
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cod', 'upi') THEN
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
    'reserved',
    p_payment_method,
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
      status = 'placed',
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
