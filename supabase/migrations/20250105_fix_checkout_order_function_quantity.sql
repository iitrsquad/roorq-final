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
