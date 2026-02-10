-- Migration: Auto-award referral reward on invitee's first qualifying order

BEGIN;

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
    NEW.status IN ('placed', 'packed', 'out_for_delivery', 'delivered') OR
    NEW.payment_status = 'paid' OR
    NEW.cod_collected IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  -- Ensure this is the invitee's first qualifying order
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
AFTER UPDATE OF status, payment_status, cod_collected ON public.orders
FOR EACH ROW
WHEN (
  (NEW.status IN ('placed', 'packed', 'out_for_delivery', 'delivered') AND OLD.status IS DISTINCT FROM NEW.status) OR
  (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status) OR
  (NEW.cod_collected IS TRUE AND OLD.cod_collected IS DISTINCT FROM NEW.cod_collected)
)
EXECUTE FUNCTION public.handle_referral_on_order_completion();

COMMIT;
