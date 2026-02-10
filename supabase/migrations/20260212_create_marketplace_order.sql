-- Migration: Marketplace order creation RPC
-- Date: 2026-02-12

BEGIN;

CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_items JSONB,
  p_shipping_address JSONB,
  p_billing_address JSONB DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cod'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_parent_id UUID;
  v_total NUMERIC := 0;
  v_item RECORD;
  v_vendor RECORD;
  v_price NUMERIC;
  v_subtotal NUMERIC;
  v_commission_rate NUMERIC;
  v_commission NUMERIC;
  v_vendor_payout NUMERIC;
  v_vendor_order_id UUID;
  v_order_number TEXT;
  v_is_active BOOLEAN;
  v_approval_status TEXT;
  v_stock INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001';
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cod', 'upi', 'card') THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = 'P0001';
  END IF;

  IF p_shipping_address IS NULL OR jsonb_typeof(p_shipping_address) <> 'object' THEN
    RAISE EXCEPTION 'Shipping address is required' USING ERRCODE = 'P0001';
  END IF;

  v_order_number := generate_order_number();

  INSERT INTO public.parent_orders (
    user_id,
    order_number,
    total_amount,
    shipping_address,
    billing_address,
    payment_method,
    payment_status
  ) VALUES (
    v_user_id,
    v_order_number,
    0,
    p_shipping_address,
    p_billing_address,
    p_payment_method,
    'pending'
  )
  RETURNING id INTO v_parent_id;

  -- Validate items and reserve inventory
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

    SELECT
      COALESCE(platform_price, price),
      is_active,
      approval_status,
      stock_quantity
    INTO v_price, v_is_active, v_approval_status, v_stock
    FROM public.products
    WHERE id = v_item.product_id;

    IF NOT FOUND OR v_is_active IS DISTINCT FROM TRUE OR v_approval_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Product not available: %', v_item.product_id USING ERRCODE = 'P0001';
    END IF;

    IF v_stock IS NOT NULL AND v_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product: %', v_item.product_id USING ERRCODE = 'P0001';
    END IF;

    PERFORM reserve_inventory(v_item.product_id, v_item.quantity::INT);
  END LOOP;

  -- Create vendor orders grouped by vendor
  FOR v_vendor IN
    SELECT DISTINCT p.vendor_id
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.products p ON p.id = (item->>'productId')::UUID
  LOOP
    SELECT
      SUM((item->>'quantity')::INT * COALESCE(p.platform_price, p.price))
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.products p ON p.id = (item->>'productId')::UUID
    WHERE p.vendor_id IS NOT DISTINCT FROM v_vendor.vendor_id;

    v_commission_rate := COALESCE(
      (SELECT commission_rate FROM public.users WHERE id = v_vendor.vendor_id),
      15.00
    );
    v_commission := (v_subtotal * v_commission_rate) / 100;
    v_vendor_payout := v_subtotal - v_commission;

    INSERT INTO public.vendor_orders (
      parent_order_id,
      vendor_id,
      subtotal,
      shipping_fee,
      platform_commission,
      vendor_payout,
      status
    ) VALUES (
      v_parent_id,
      v_vendor.vendor_id,
      v_subtotal,
      0,
      v_commission,
      v_vendor_payout,
      'pending'
    )
    RETURNING id INTO v_vendor_order_id;

    INSERT INTO public.vendor_order_items (
      vendor_order_id,
      product_id,
      quantity,
      price_at_purchase
    )
    SELECT
      v_vendor_order_id,
      p.id,
      (item->>'quantity')::INT,
      COALESCE(p.platform_price, p.price)
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.products p ON p.id = (item->>'productId')::UUID
    WHERE p.vendor_id IS NOT DISTINCT FROM v_vendor.vendor_id;

    v_total := v_total + v_subtotal;
  END LOOP;

  UPDATE public.parent_orders
  SET total_amount = v_total,
      updated_at = NOW()
  WHERE id = v_parent_id;

  RETURN jsonb_build_object(
    'parent_order_id', v_parent_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_marketplace_order(JSONB, JSONB, JSONB, TEXT) TO authenticated;

COMMIT;
