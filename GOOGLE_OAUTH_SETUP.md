# Google OAuth Setup for Supabase

Since you've already set up Google Cloud Console, here are the final steps to enable Google OAuth in Supabase:

## 1. In Google Cloud Console

You should already have:
- A project created
- OAuth 2.0 credentials configured
- Client ID and Client Secret generated

## 2. In Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list and click to expand
4. Toggle **Enable Google provider** to ON
5. Add your credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
6. Copy the **Redirect URL** from Supabase (it will be something like: `https://[your-project-ref].supabase.co/auth/v1/callback`)

## 3. Back in Google Cloud Console

1. Go to your OAuth 2.0 Client ID settings
2. Add the Supabase redirect URL to **Authorized redirect URIs**:
   - Add: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Also add for local testing: `http://localhost:3000/auth/callback`

## 4. Enable Phone Authentication in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Phone** and enable it
3. Configure SMS provider (Twilio recommended):
   - Sign up for Twilio if you haven't
   - Get your Account SID and Auth Token
   - Get a Twilio phone number
   - Add these to Supabase Phone settings

## 5. Update Auth Settings

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add these URLs:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: 
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth`
     - `http://localhost:3000/shop`
     - Your production URLs when ready

## 6. Test the Integration

1. Start your development server: `npm run dev`
2. Go to `http://localhost:3000/auth`
3. Try signing in with Google
4. Try phone number authentication

## Environment Variables

Make sure your `.env.local` has these (already in your project):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Troubleshooting

### Google Sign-in not working?
- Check that the redirect URI in Google Console matches exactly
- Ensure the Client ID and Secret are correctly entered in Supabase
- Check browser console for specific error messages

### Phone OTP not sending?
- Verify Twilio credentials in Supabase
- Check Twilio account has sufficient balance
- Ensure phone number format is correct (+91 for India)

### Users not getting created in public.users table?
- The auth trigger should handle this automatically
- Check if RLS policies are correctly set up (we fixed this earlier)