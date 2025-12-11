import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type'); // 'magiclink' | 'otp'
  const redirect = requestUrl.searchParams.get('redirect') || '/shop';
  const origin = requestUrl.origin;
  
  // Get referral code if present (persisted through auth flow)
  const refCode = requestUrl.searchParams.get('ref');

  const supabase = await createClient();

  try {
    let user = null;

    // FLOW 1: Magic Link (PKCE) - Code Exchange
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Auth Exchange Error:', error);
        // Map errors for better UX
        if (error.message.includes('expired') || error.code === 'otp_expired') {
          return NextResponse.redirect(`${origin}/auth?error=expired`);
        }
        if (error.message.includes('invalid') || error.code === 'otp_disabled') {
          return NextResponse.redirect(`${origin}/auth?error=invalid`);
        }
        if (error.message.includes('used')) {
          return NextResponse.redirect(`${origin}/auth?error=used`);
        }
        return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error.message)}`);
      }
      user = data.user;
    } 
    // FLOW 2: OTP / Existing Session - Verify Session
    else {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        console.error('Session Check Error:', error);
        return NextResponse.redirect(`${origin}/auth?error=invalid_session`);
      }
      user = data.user;
    }

    if (!user) {
      return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
    }

    // --- Centralized Post-Auth Logic ---

    // 1. Check User Profile
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', user.id)
      .single();

    // 2. New User Handling
    if (!existingUser) {
      // Generate unique referral code
      const referralCode = `REF-${user.id.slice(0, 8).toUpperCase()}`;
      
      // Create Profile
      const { error: createError } = await supabase.from('users').insert({
        id: user.id,
        email: user.email!,
        referral_code: referralCode,
      });

      if (createError) {
        console.error('Profile Creation Error:', createError);
        // Continue anyway, user exists in Auth. Can retry profile later.
      }

      // Handle Referral attribution
      if (refCode) {
        const { data: referrer } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', refCode)
          .single();

        if (referrer && referrer.id !== user.id) {
          await supabase.from('referrals').insert({
            referrer_id: referrer.id,
            invitee_id: user.id,
            status: 'pending',
          });
        }
      }
      
      // Redirect new users to profile completion
      return NextResponse.redirect(`${origin}/profile?new=true`);
    }

    // 3. Existing User Routing
    // If profile incomplete (e.g., no name), send to profile to complete it
    if (!existingUser.full_name) {
       return NextResponse.redirect(`${origin}/profile?setup=required`);
    }

    // 4. Success Redirect
    // Ensure the redirect URL is absolute or relative to origin to prevent open redirect vulnerabilities
    const finalRedirect = redirect.startsWith('http') ? redirect : `${origin}${redirect}`;
    return NextResponse.redirect(finalRedirect);

  } catch (error: any) {
    console.error('Callback Unexpected Error:', error);
    return NextResponse.redirect(`${origin}/auth?error=network`);
  }
}
