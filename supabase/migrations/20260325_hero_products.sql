-- ─────────────────────────────────────────────────────────
-- Hero products: two new columns on the products table
--   hero_position  SMALLINT 1-10  → slot in the homepage hero
--   hero_image     TEXT          → URL of the bg-removed PNG
--                                  (stored in Supabase Storage
--                                   bucket "hero-images")
-- ─────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hero_image    TEXT,
  ADD COLUMN IF NOT EXISTS hero_position SMALLINT;

-- Only one product can occupy each hero slot at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_hero_position_unique
  ON products (hero_position)
  WHERE hero_position IS NOT NULL;

-- ── Storage bucket for bg-removed hero images ──────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-images',
  'hero-images',
  true,
  5242880,                                    -- 5 MB max per image
  ARRAY['image/png', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view hero images (they are public)
CREATE POLICY "hero_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-images');

-- Only admins / service-role can upload / replace hero images
CREATE POLICY "hero_images_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hero-images'
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "hero_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'hero-images'
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
      )
    )
  );
