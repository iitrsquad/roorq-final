-- Migration: Atomic Payment Processing Function
-- Date: 2024-05-23
-- Description: Adds a stored procedure to handle payment success atomically

BEGIN;

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
  -- Only update if it's not already paid/delivered/cancelled to avoid overwriting final states
  -- But 'reserved' -> 'placed' is the main transition we want.
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
    'success',
    NOW()
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
