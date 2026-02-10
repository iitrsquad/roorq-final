# Roorq.in - Campus Fashion Drops

Roorq is a campus-first weekly-drop fashion platform built with Next.js and Supabase. Phase 1 is COD/UPI-on-delivery only (no online payments).

## Phase 1 Payment Model (COD-Only)
- Primary: Cash on Delivery (COD)
- Optional: UPI on Delivery (paid to rider at delivery)
- Online gateways are disabled for Phase 1

## Tech Stack
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Backend: Supabase (Postgres, Auth, Storage, Realtime)
- Emails: Resend (transactional), Mailchimp (optional marketing)
- Hosting: Vercel
- Monitoring: Sentry

## Local Development
1. Install dependencies:
   ```
   npm install
   ```
2. Create `.env.local` from `.env.example`:
   ```
   copy .env.example .env.local
   ```
3. Update the Supabase keys and service role values.
4. Start the dev server:
   ```
   npm run dev
   ```
5. Optional staging config:
   ```
   npm run dev:staging
   ```

## Database Setup
1. Create a Supabase project.
2. Run migrations in `supabase/migrations/` in order.
3. Verify required functions exist:
   - `create_checkout_order`
   - `process_cod_payment`
   - `cancel_cod_order`
   - `reserve_inventory`
   - `release_inventory`

## Admin Access
- Admin UI: `/admin`
- Roles: `admin` and `super_admin`
- Role management is handled in the admin users page.

## Documentation
- Architecture: `ARCHITECTURE_DIAGRAM.md`
- API Docs: `API_DOCUMENTATION.md`
- Admin Guide: `ADMIN_GUIDE.md`
- Troubleshooting: `TROUBLESHOOTING.md`
- Deployment Checklist: `DEPLOYMENT_CHECKLIST.md`
- Pre-Launch Validation: `PRE_LAUNCH_VALIDATION.md`
- Load testing: `LOAD_TESTING_REPORT.md` and `load-tests/README.md`

## Deployment (Vercel)
1. Push to GitHub.
2. Import the project in Vercel.
3. Set environment variables (see `.env.production.example`).
4. Run Supabase migrations.
5. Verify Sentry is reporting events.

## License
Proprietary - all rights reserved.
