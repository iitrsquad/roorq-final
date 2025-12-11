import { redirect } from 'next/navigation';

export default function SignupPage({ searchParams }: { searchParams: { ref?: string } }) {
  // Redirect to login page, preserving referral code if present
  // The login page now handles both "Sign In" and "Sign Up" logic via OTP/Magic Link
  const params = new URLSearchParams();
  if (searchParams.ref) {
    params.set('ref', searchParams.ref);
  }
  
  redirect(`/auth?${params.toString()}`);
}
