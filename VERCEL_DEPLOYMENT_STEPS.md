# 🚀 Vercel Deployment Steps - GitHub Repository

## Step-by-Step Guide to Deploy from GitHub to Vercel

### Step 1: Sign in to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Log In"**
3. Choose **"Continue with GitHub"** to connect your GitHub account
4. Authorize Vercel to access your GitHub repositories

### Step 2: Import Your Repository

1. After logging in, you'll see the Vercel dashboard
2. Click **"Add New..."** → **"Project"**
3. You'll see a list of your GitHub repositories
4. Find and select **`iitrsquad/roorq3`**
5. Click **"Import"**

### Step 3: Configure Project Settings

Vercel will auto-detect Next.js settings. Verify:

- **Framework Preset:** Next.js (should be auto-detected)
- **Root Directory:** `./` (leave as default)
- **Build Command:** `npm run build` (auto-filled)
- **Output Directory:** `.next` (auto-filled)
- **Install Command:** `npm install` (auto-filled)

**Click "Deploy"** - but wait! Don't deploy yet if you need to add environment variables first.

### Step 4: Add Environment Variables (CRITICAL)

**Before deploying**, add all required environment variables:

1. In the project import screen, click **"Environment Variables"** section
2. Or after creating the project, go to **Settings → Environment Variables**

Add these variables (one by one):

#### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL
```
- Value: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- Environments: ✅ Production, ✅ Preview, ✅ Development

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
- Value: Your Supabase anon/public key
- Environments: ✅ Production, ✅ Preview, ✅ Development

```
SUPABASE_SERVICE_ROLE_KEY
```
- Value: Your Supabase service role key (keep secret!)
- Environments: ✅ Production, ✅ Preview, ✅ Development

```
RAZORPAY_KEY_ID
```
- Value: Your Razorpay Key ID
- Environments: ✅ Production, ✅ Preview, ✅ Development

```
RAZORPAY_KEY_SECRET
```
- Value: Your Razorpay Key Secret (keep secret!)
- Environments: ✅ Production, ✅ Preview, ✅ Development

```
NEXT_PUBLIC_RAZORPAY_KEY_ID
```
- Value: Your Razorpay Key ID (same as RAZORPAY_KEY_ID)
- Environments: ✅ Production, ✅ Preview, ✅ Development

```
RAZORPAY_WEBHOOK_SECRET
```
- Value: Your Razorpay Webhook Secret
- Environments: ✅ Production, ✅ Preview, ✅ Development

#### Optional (for email notifications):

```
RESEND_API_KEY
```
- Value: Your Resend API key (if using email notifications)
- Environments: ✅ Production, ✅ Preview, ✅ Development

**Important Notes:**
- ✅ Check all three environments (Production, Preview, Development) for each variable
- 🔒 Never commit these values to GitHub
- 📝 Copy values exactly (no extra spaces or quotes)

### Step 5: Deploy

1. After adding all environment variables, click **"Deploy"**
2. Wait for the build to complete (usually 2-5 minutes)
3. You'll see build logs in real-time
4. Once complete, you'll get a deployment URL like: `https://roorq3-xxxxx.vercel.app`

### Step 6: Configure Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain (e.g., `roorq.in`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (can take up to 24 hours)

### Step 7: Update Supabase Auth URLs

**CRITICAL:** After deployment, update Supabase authentication URLs:

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication → URL Configuration**
3. Set **Site URL** to your Vercel URL:
   ```
   https://your-app.vercel.app
   ```
   Or your custom domain:
   ```
   https://roorq.in
   ```

4. Add **Redirect URLs**:
   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app/auth
   https://your-app.vercel.app/*
   ```

   If using custom domain:
   ```
   https://roorq.in/auth/callback
   https://roorq.in/auth
   https://roorq.in/*
   ```

### Step 8: Verify Deployment

Test these features:

- [ ] Homepage loads correctly
- [ ] Authentication works (sign up/login)
- [ ] Products page loads
- [ ] Cart functionality works
- [ ] Checkout flow works
- [ ] Admin panel accessible (if you have admin access)
- [ ] Payment integration (test with Razorpay test mode)

### Step 9: Enable Automatic Deployments

Vercel automatically deploys when you push to GitHub:

- **Production:** Deploys from `main` branch
- **Preview:** Deploys from other branches and pull requests

No additional setup needed - it's automatic! 🎉

### Troubleshooting

#### Build Fails
- Check environment variables are set correctly
- Verify all values are correct (no typos)
- Check build logs for specific errors

#### Authentication Not Working
- Verify Supabase URLs are updated
- Check environment variables are set
- Ensure redirect URLs match exactly

#### Payment Not Working
- Verify Razorpay keys are correct
- Check webhook URL in Razorpay dashboard
- Ensure `RAZORPAY_WEBHOOK_SECRET` matches

#### 404 Errors
- Check Next.js routing configuration
- Verify all pages are in correct directories
- Check middleware configuration

### Quick Reference

**Vercel Dashboard:** https://vercel.com/dashboard  
**Your Repository:** https://github.com/iitrsquad/roorq3  
**Supabase Dashboard:** https://supabase.com/dashboard

### Need Help?

- Vercel Docs: https://vercel.com/docs
- Next.js on Vercel: https://vercel.com/docs/frameworks/nextjs
- Check build logs in Vercel dashboard for specific errors

