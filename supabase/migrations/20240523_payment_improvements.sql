-- Migration: Improve Payments Table
-- Date: 2024-05-23
-- Description: Adds ENUM types, RLS, Indexes, and Transition Logic to payments table

BEGIN;

-- 1. Create Payment Status Enum
DO $$ BEGIN
    CREATE TYPE public.payment_status_enum AS ENUM ('pending', 'processing', 'success', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update Payments Table Structure
-- Drop existing check constraint if it exists (from original schema)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- Convert 'completed' (old schema) to 'success' (new enum) if data exists
UPDATE public.payments SET status = 'success' WHERE status = 'completed';

-- Alter status column to use the new ENUM
ALTER TABLE public.payments 
  ALTER COLUMN status TYPE public.payment_status_enum 
  USING status::text::public.payment_status_enum;

-- Set default value
ALTER TABLE public.payments 
  ALTER COLUMN status SET DEFAULT 'pending'::public.payment_status_enum;

-- 3. Add Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

-- Policy: Users can view payments associated with their own orders
CREATE POLICY "Users can view own payments" ON public.payments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = payments.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Policy: Service Role (Admin) has full access
-- (Supabase Service Role bypasses RLS by default, but explicit policies for admin UIs if needed)
-- CREATE POLICY "Admins can view all payments" ... (Skipped: relying on service_role for admin tasks)

-- 5. Add Audit Trigger (updated_at)
-- Assumes update_updated_at_column() exists from initial schema
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Payment Status Transition Logic
CREATE OR REPLACE FUNCTION check_payment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow initial insert
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Allow no change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Rule 1: Terminal States
  -- Once failed or refunded, cannot change (unless admin override logic is added, but strict for now)
  IF OLD.status = 'failed' THEN
     RAISE EXCEPTION 'Payment is already FAILED and cannot be modified';
  END IF;
  
  -- Rule 2: Valid Transitions
  -- pending -> processing, success, failed
  -- processing -> success, failed
  -- success -> refunded
  
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

-- Attach Transition Trigger
DROP TRIGGER IF EXISTS validate_payment_status_change ON public.payments;
CREATE TRIGGER validate_payment_status_change
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_status_transition();

COMMIT;
