# Roorq.in - Campus Fashion Weekly Drops

A campus-exclusive weekly-drop fashion platform for IIT Roorkee, built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- 🎯 **Campus-First**: Exclusive to IIT Roorkee students
- 📦 **Weekly Drops**: Limited-quantity products released every Wednesday
- 💰 **COD-First**: Cash on delivery default, UPI unlocks after first successful order
- 🎁 **Referral System**: Mirror-item rewards - get free items when friends order
- 🚚 **Same-Day Delivery**: 24-hour campus fulfillment
- 📱 **Mobile-First**: Optimized for mobile shopping experience
- 🔐 **Secure Auth**: Email OTP authentication with IIT domain validation

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd roorq
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. Set up the database:
- Go to your Supabase project SQL Editor
- Run the SQL from `supabase/schema.sql`

5. Deploy Edge Functions:
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy reserve-inventory
supabase functions deploy on-cod-collected
supabase functions deploy release-reservation
```

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── admin/             # Admin panel pages
│   ├── auth/              # Authentication pages
│   ├── cart/              # Shopping cart
│   ├── checkout/          # Checkout flow
│   ├── orders/            # Order tracking
│   ├── products/          # Product detail pages
│   ├── referrals/         # Referral program
│   ├── shop/              # Product catalog
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Utility functions
│   └── supabase/         # Supabase client setup
├── supabase/
│   ├── functions/        # Edge Functions
│   └── schema.sql        # Database schema
└── public/               # Static assets
```

## Key Features Implementation

### COD-First Payment Flow
- Default payment method is COD
- UPI option only appears after `first_cod_done` flag is true
- Edge function `on-cod-collected` updates user status on COD confirmation

### Referral System
- Each user gets a unique referral code
- When invitee completes first COD order, referrer gets a free item in the same category
- Rewards tracked in `referral_rewards` table

### Inventory Management
- Atomic inventory reservations prevent overselling
- 10-minute reservation TTL
- Automatic cleanup of expired reservations

### Weekly Drops
- Products assigned to drops
- Scheduled publish times
- Status tracking (draft, scheduled, live, ended)

## Admin Panel

Access the admin panel at `/admin` (requires authentication). Features:
- Product management
- Order queue and fulfillment
- Referral tracking
- Analytics dashboard

## Database Schema

Key tables:
- `users` - User profiles with referral codes
- `products` - Product catalog
- `drops` - Weekly drop schedules
- `orders` - Order management
- `referrals` - Referral tracking
- `referral_rewards` - Reward management
- `inventory_reservations` - Cart reservations

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

Make sure to set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for Edge Functions)

## Contributing

This is a private project for IIT Roorkee. For questions or issues, contact the team.

## License

Proprietary - All rights reserved

