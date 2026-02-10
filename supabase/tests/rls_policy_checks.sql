-- RLS policy smoke tests
-- Replace placeholder UUIDs with real user IDs from auth.users/public.users.

-- ---------- ANON ----------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

-- Products: anyone can view active products
SELECT id FROM public.products WHERE is_active = TRUE; -- expect rows
SELECT id FROM public.products WHERE is_active = FALSE; -- expect 0 rows

-- Drops: public read (adjust if your policy is different)
SELECT id FROM public.drops; -- expect rows for published/live drops

-- Orders: anon should not see any
SELECT id FROM public.orders; -- expect 0 rows

-- ---------- AUTHENTICATED USER A ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<USER_A_UUID>","role":"authenticated"}', true);

-- Users: can read/update own profile only
SELECT id, email FROM public.users WHERE id = auth.uid(); -- expect 1 row
SELECT id FROM public.users WHERE id <> auth.uid(); -- expect 0 rows

-- Orders: can view own
SELECT id FROM public.orders WHERE user_id = auth.uid(); -- expect rows
SELECT id FROM public.orders WHERE user_id <> auth.uid(); -- expect 0 rows

-- Order items: can view own
SELECT oi.id
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.user_id = auth.uid(); -- expect rows

-- Payments: can view own
SELECT p.id
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
WHERE o.user_id = auth.uid(); -- expect rows

-- Inventory reservations: can insert/view own
-- Replace <PRODUCT_ID> with a real product UUID.
INSERT INTO public.inventory_reservations (product_id, user_id, quantity, expires_at)
VALUES ('<PRODUCT_ID>', auth.uid(), 1, NOW() + INTERVAL '10 minutes'); -- expect success

SELECT id FROM public.inventory_reservations WHERE user_id = auth.uid(); -- expect rows

-- Referrals and rewards: can view own
SELECT id FROM public.referrals WHERE referrer_id = auth.uid() OR invitee_id = auth.uid(); -- expect rows
SELECT id FROM public.referral_rewards WHERE user_id = auth.uid(); -- expect rows

-- Riders: read-only for authenticated users
SELECT id FROM public.riders; -- expect rows
UPDATE public.riders SET is_active = FALSE WHERE id IS NOT NULL; -- expect failure

-- ---------- ADMIN USER ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<ADMIN_USER_UUID>","role":"authenticated"}', true);

-- Admin user must have role = 'admin' or 'super_admin' in public.users
SELECT id FROM public.users; -- expect rows (admin can view all)

-- Admins can update orders
UPDATE public.orders SET status = status WHERE id IS NOT NULL; -- expect success

-- Riders management
INSERT INTO public.riders (name, phone) VALUES ('Test Rider', '+910000000000'); -- expect success
