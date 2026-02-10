-- COD fulfillment helpers: link reservations to orders, add cancellation metadata, and add admin RPCs.

-- Link inventory reservations to orders so we can release/convert stock safely.
ALTER TABLE public.inventory_reservations
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id
  ON public.inventory_reservations(order_id);

-- Track cancellation metadata for RTO and admin-driven cancels.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Only expire cart holds (reservations without an order_id).
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
    PERFORM release_inventory(
      reservation_record.product_id,
      reservation_record.quantity
    );
    released_count := released_count + 1;
  END LOOP;

  DELETE FROM public.inventory_reservations
  WHERE expires_at < NOW()
    AND order_id IS NULL;

  RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Update checkout function to link reservations to order_id.
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

-- Mark COD payment collected + adjust inventory in one transaction.
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

-- Cancel COD order + release inventory + mark failure.
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
