-- Migration: Add Gender Column to Products
-- Date: 2024-06-04
-- Description: Adds gender column for filtering products by Men's/Women's/Kids

BEGIN;

-- 1. Add gender column with default value
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS gender TEXT 
DEFAULT 'unisex'
CHECK (gender IN ('men', 'women', 'unisex', 'kids'));

-- 2. Create index for faster gender filtering
CREATE INDEX IF NOT EXISTS idx_products_gender ON public.products(gender);

-- 3. Update any NULL values to 'unisex'
UPDATE public.products 
SET gender = 'unisex' 
WHERE gender IS NULL;

COMMIT;

