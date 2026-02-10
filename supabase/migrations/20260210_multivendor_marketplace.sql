-- Migration: Multi-vendor marketplace core schema
-- Date: 2026-02-10

BEGIN;

-- ============================================
-- 1. EXTEND USERS TABLE FOR VENDORS
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS vendor_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS business_category TEXT,
  ADD COLUMN IF NOT EXISTS business_email TEXT,
  ADD COLUMN IF NOT EXISTS business_phone TEXT,
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS store_description TEXT,
  ADD COLUMN IF NOT EXISTS store_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS store_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address JSONB,
  ADD COLUMN IF NOT EXISTS return_address JSONB,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vendor_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_user_type_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_user_type_check
      CHECK (user_type IN ('customer', 'vendor', 'admin', 'super_admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_vendor_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_vendor_status_check
      CHECK (vendor_status IN ('pending', 'documents_pending', 'under_review', 'approved', 'rejected', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_business_type_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_business_type_check
      CHECK (business_type IN ('individual', 'proprietorship', 'partnership', 'pvt_ltd', 'llp'));
  END IF;
END $$;

-- Unique GSTIN if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_gstin'
  ) THEN
    CREATE UNIQUE INDEX idx_users_gstin ON public.users (gstin) WHERE gstin IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 2. VENDOR DOCUMENTS (KYC)
-- ============================================

CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_number TEXT,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_documents_document_type_check'
  ) THEN
    ALTER TABLE public.vendor_documents
      ADD CONSTRAINT vendor_documents_document_type_check
      CHECK (document_type IN (
        'pan_card',
        'gst_certificate',
        'bank_proof',
        'address_proof',
        'identity_proof',
        'business_registration'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_documents_status_check'
  ) THEN
    ALTER TABLE public.vendor_documents
      ADD CONSTRAINT vendor_documents_status_check
      CHECK (status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor ON public.vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_status ON public.vendor_documents(status);

-- ============================================
-- 3. UPDATE PRODUCTS TABLE (Multi-Vendor)
-- ============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER,
  ADD COLUMN IF NOT EXISTS dimensions JSONB,
  ADD COLUMN IF NOT EXISTS shipping_time_days INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS vendor_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS platform_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sold_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_approval_status_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'delisted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_condition_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_condition_check
      CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON public.products(approval_status);

-- Set defaults for existing products
UPDATE public.products
SET approval_status = 'approved'
WHERE approval_status IS NULL;

UPDATE public.products
SET vendor_price = COALESCE(vendor_price, price),
    platform_price = COALESCE(platform_price, price)
WHERE vendor_price IS NULL OR platform_price IS NULL;

-- ============================================
-- 4. ORDERS TABLE (Multi-Vendor Split)
-- ============================================

CREATE TABLE IF NOT EXISTS public.parent_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  order_number TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parent_orders_payment_method_check'
  ) THEN
    ALTER TABLE public.parent_orders
      ADD CONSTRAINT parent_orders_payment_method_check
      CHECK (payment_method IN ('cod', 'upi', 'card'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parent_orders_payment_status_check'
  ) THEN
    ALTER TABLE public.parent_orders
      ADD CONSTRAINT parent_orders_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_order_id UUID REFERENCES public.parent_orders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  platform_commission DECIMAL(10,2) NOT NULL,
  vendor_payout DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_orders_status_check'
  ) THEN
    ALTER TABLE public.vendor_orders
      ADD CONSTRAINT vendor_orders_status_check
      CHECK (status IN (
        'pending',
        'confirmed',
        'processing',
        'ready_to_ship',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
        'refunded'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_order_id UUID REFERENCES public.vendor_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_orders_vendor ON public.vendor_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_parent ON public.vendor_orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON public.vendor_orders(status);

-- ============================================
-- 5. VENDOR PAYOUTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  total_shipping_collected DECIMAL(10,2) DEFAULT 0,
  payout_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_payouts_status_check'
  ) THEN
    ALTER TABLE public.vendor_payouts
      ADD CONSTRAINT vendor_payouts_status_check
      CHECK (status IN ('pending', 'processing', 'paid', 'failed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payout_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.vendor_payouts(id) ON DELETE CASCADE,
  vendor_order_id UUID REFERENCES public.vendor_orders(id),
  order_amount DECIMAL(10,2) NOT NULL,
  commission DECIMAL(10,2) NOT NULL,
  payout_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON public.vendor_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON public.vendor_payouts(status);

-- ============================================
-- 6. VENDOR ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS public.vendor_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  products_listed INTEGER DEFAULT 0,
  products_active INTEGER DEFAULT 0,
  products_out_of_stock INTEGER DEFAULT 0,
  orders_received INTEGER DEFAULT 0,
  orders_confirmed INTEGER DEFAULT 0,
  orders_shipped INTEGER DEFAULT 0,
  orders_delivered INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  orders_returned INTEGER DEFAULT 0,
  gross_sales DECIMAL(10,2) DEFAULT 0,
  platform_commission DECIMAL(10,2) DEFAULT 0,
  net_revenue DECIMAL(10,2) DEFAULT 0,
  avg_shipping_time_hours INTEGER,
  avg_delivery_time_days DECIMAL(4,1),
  return_rate DECIMAL(5,2),
  cancellation_rate DECIMAL(5,2),
  avg_rating DECIMAL(3,2),
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_vendor_analytics_vendor_date ON public.vendor_analytics(vendor_id, date DESC);

-- ============================================
-- 7. VENDOR NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.vendor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_notifications_type_check'
  ) THEN
    ALTER TABLE public.vendor_notifications
      ADD CONSTRAINT vendor_notifications_type_check
      CHECK (type IN (
        'new_order',
        'order_cancelled',
        'payment_released',
        'payout_processed',
        'product_approved',
        'product_rejected',
        'account_suspended',
        'document_required',
        'low_stock_alert'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor ON public.vendor_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_unread ON public.vendor_notifications(vendor_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- 8. RLS POLICIES (new tables)
-- ============================================

ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own documents" ON public.vendor_documents
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can upload documents" ON public.vendor_documents
  FOR INSERT WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Admins can manage documents" ON public.vendor_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Products policies
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;

CREATE POLICY "Approved products viewable by everyone" ON public.products
  FOR SELECT USING (approval_status = 'approved' OR vendor_id = auth.uid());

CREATE POLICY "Admins can view all products" ON public.products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Vendors can create products" ON public.products
  FOR INSERT WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Vendors can update own products" ON public.products
  FOR UPDATE USING (vendor_id = auth.uid());

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Vendors can delete own products" ON public.products
  FOR DELETE USING (vendor_id = auth.uid());

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
-- Vendor orders
CREATE POLICY "Vendors can view own orders" ON public.vendor_orders
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can update own orders" ON public.vendor_orders
  FOR UPDATE USING (vendor_id = auth.uid());

CREATE POLICY "Customers can view vendor orders" ON public.vendor_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_orders
      WHERE parent_orders.id = vendor_orders.parent_order_id
        AND parent_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all vendor orders" ON public.vendor_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update vendor orders" ON public.vendor_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Vendors can view own order items" ON public.vendor_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendor_orders
      WHERE vendor_orders.id = vendor_order_items.vendor_order_id
      AND vendor_orders.vendor_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view vendor order items" ON public.vendor_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendor_orders vo
      JOIN public.parent_orders po ON po.id = vo.parent_order_id
      WHERE vo.id = vendor_order_items.vendor_order_id
        AND po.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view vendor order items" ON public.vendor_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
-- Vendor payouts
CREATE POLICY "Vendors can view own payouts" ON public.vendor_payouts
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "Admins can view all payouts" ON public.vendor_payouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Vendors can view own payout items" ON public.payout_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendor_payouts
      WHERE vendor_payouts.id = payout_line_items.payout_id
      AND vendor_payouts.vendor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view payout items" ON public.payout_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
-- Vendor analytics
CREATE POLICY "Vendors can view own analytics" ON public.vendor_analytics
  FOR SELECT USING (vendor_id = auth.uid());

-- Vendor notifications
CREATE POLICY "Vendors can view own notifications" ON public.vendor_notifications
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can update own notifications" ON public.vendor_notifications
  FOR UPDATE USING (vendor_id = auth.uid());

-- Parent orders (customers)
CREATE POLICY "Customers can view own parent orders" ON public.parent_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Customers can create own parent orders" ON public.parent_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all parent orders" ON public.parent_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update parent orders" ON public.parent_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 9. FUNCTIONS & TRIGGERS
-- ============================================

-- Calculate vendor payout from vendor_orders
CREATE OR REPLACE FUNCTION public.calculate_vendor_payout(order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  subtotal DECIMAL;
  commission_rate DECIMAL;
  commission DECIMAL;
  payout DECIMAL;
BEGIN
  SELECT vo.subtotal, u.commission_rate
  INTO subtotal, commission_rate
  FROM public.vendor_orders vo
  JOIN public.users u ON u.id = vo.vendor_id
  WHERE vo.id = order_id;

  commission := (subtotal * commission_rate) / 100;
  payout := subtotal - commission;

  RETURN payout;
END;
$$ LANGUAGE plpgsql;

-- Vendor order status tracking
CREATE OR REPLACE FUNCTION public.update_vendor_order_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();

  IF NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.shipped_at := NOW();
  END IF;

  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.delivered_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_order_status_update ON public.vendor_orders;
CREATE TRIGGER trigger_vendor_order_status_update
  BEFORE UPDATE ON public.vendor_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_order_status();

-- Notify vendor on new order
CREATE OR REPLACE FUNCTION public.notify_vendor_new_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vendor_notifications (vendor_id, type, title, message, action_url, metadata)
  VALUES (
    NEW.vendor_id,
    'new_order',
    'New Order Received',
    'You have received a new order #' || NEW.id,
    '/seller/orders/' || NEW.id,
    jsonb_build_object('order_id', NEW.id, 'amount', NEW.subtotal)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_vendor_new_order ON public.vendor_orders;
CREATE TRIGGER trigger_notify_vendor_new_order
  AFTER INSERT ON public.vendor_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vendor_new_order();

-- Update profile completion
CREATE OR REPLACE FUNCTION public.update_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
  completion INT := 0;
BEGIN
  IF NEW.business_name IS NOT NULL THEN completion := completion + 10; END IF;
  IF NEW.business_email IS NOT NULL THEN completion := completion + 10; END IF;

  IF NEW.pan_number IS NOT NULL THEN completion := completion + 15; END IF;
  IF NEW.gstin IS NOT NULL THEN completion := completion + 15; END IF;

  IF NEW.store_name IS NOT NULL THEN completion := completion + 10; END IF;
  IF NEW.store_description IS NOT NULL THEN completion := completion + 10; END IF;

  IF NEW.bank_account_number IS NOT NULL THEN completion := completion + 20; END IF;

  IF NEW.pickup_address IS NOT NULL THEN completion := completion + 10; END IF;

  NEW.profile_completion := completion;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profile_completion ON public.users;
CREATE TRIGGER trigger_update_profile_completion
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.user_type = 'vendor')
  EXECUTE FUNCTION public.update_profile_completion();

-- Updated_at triggers for new tables
DROP TRIGGER IF EXISTS update_parent_orders_updated_at ON public.parent_orders;
CREATE TRIGGER update_parent_orders_updated_at BEFORE UPDATE ON public.parent_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_orders_updated_at ON public.vendor_orders;
CREATE TRIGGER update_vendor_orders_updated_at BEFORE UPDATE ON public.vendor_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
