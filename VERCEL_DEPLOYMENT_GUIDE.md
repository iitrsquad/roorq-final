# 🚀 Quick Vercel Deployment Guide

## Step 1: Install Missing Dependencies

```bash
npm install
```

The `razorpay` package has been added to `package.json`. Run the above command to install it.

## Step 2: Test Build Locally

```bash
npm run build
```

If the build succeeds, you're ready for Vercel!

## Step 3: Push to GitHub

```bash
git add .
git commit -m "Add Razorpay dependency and prepare for deployment"
git push
```

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js settings

## Step 5: Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
RESEND_API_KEY=your_resend_api_key
```

**Important:** 
- Set these for **Production**, **Preview**, and **Development** environments
- `NEXT_PUBLIC_*` variables are exposed to the browser
- Other variables are server-side only

## Step 6: Deploy

Click "Deploy" and wait for the build to complete.

## Step 7: Configure Supabase

### Update Auth URLs:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL:** `https://your-app.vercel.app`
3. Add **Redirect URLs:**
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/auth`

### Deploy Edge Functions:
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-payment
supabase functions deploy verify-payment
supabase functions deploy razorpay-webhook
supabase functions deploy notify
```

### Set Edge Function Secrets:
In Supabase Dashboard → Edge Functions → Secrets, add:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RESEND_API_KEY`

## Step 8: Configure Razorpay Webhook

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-project-ref.supabase.co/functions/v1/razorpay-webhook`
3. Select events: `payment.captured`, `order.paid`
4. Copy the webhook secret and add it to:
   - Vercel environment variables: `RAZORPAY_WEBHOOK_SECRET`
   - Supabase Edge Function secrets: `RAZORPAY_WEBHOOK_SECRET`

## Step 9: Test Your Deployment

1. Visit your Vercel URL
2. Test authentication flow
3. Test payment flow (use Razorpay test mode)
4. Test admin panel access

## Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set

### Payment Not Working
- Verify Razorpay keys are correct
- Check webhook configuration
- Verify Edge Functions are deployed

### Auth Not Working
- Verify Supabase URLs are updated
- Check redirect URLs in Supabase Dashboard
- Verify environment variables are set

## Need Help?

See `DEPLOYMENT_ANALYSIS.md` for detailed analysis and recommendations.

