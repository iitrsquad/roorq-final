'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Phone, Mail, Shield, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

type AuthMode = 'signin' | 'signup';
type LoginMethod = 'email' | 'phone';

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [countdown, setCountdown] = useState(0);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/shop';
  const errorParam = searchParams.get('error');
  const supabase = createClient();

  // Handle error messages from query params (e.g., from auth callback)
  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        expired: 'Your verification code has expired. Please request a new one.',
        invalid: 'Invalid verification code. Please try again.',
        used: 'This verification code has already been used.',
        invalid_session: 'Your session is invalid. Please sign in again.',
        auth_failed: 'Authentication failed. Please try again.',
        network: 'Network error. Please check your connection and try again.',
        unauthorized: 'Please sign in to continue.',
      };
      
      const message = errorMessages[errorParam] || `Error: ${errorParam}`;
      toast.error(message);
      
      // Clean URL by removing error param
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      router.replace(newUrl.pathname + newUrl.search);
    }
  }, [errorParam, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length < 4) return phoneNumber;
    if (phoneNumber.length < 7) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      toast.error('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (method === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            shouldCreateUser: mode === 'signup',
          },
        });

        if (error) throw error;
        
        setStep('otp');
        setCountdown(60);
        toast.success(`Code sent to ${email}`);
      } else {
        const cleanPhone = phone.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;
        
        const { error } = await supabase.auth.signInWithOtp({
          phone: fullPhone,
          options: {
            shouldCreateUser: mode === 'signup',
          },
        });

        if (error) throw error;
        
        setStep('otp');
        setCountdown(60);
        toast.success(`Code sent to ${formatPhoneNumber(phone)}`);
      }
    } catch (error: any) {
      console.error('Send OTP Error:', error);
      toast.error(error.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (method === 'email') {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: otp,
          type: 'email',
        });

        if (error) throw error;
      } else {
        const cleanPhone = phone.replace(/\D/g, '');
        const fullPhone = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;
        
        const { error } = await supabase.auth.verifyOtp({
          phone: fullPhone,
          token: otp,
          type: 'sms',
        });

        if (error) throw error;
      }

      toast.success('Success! Redirecting...');
      setTimeout(() => {
        // Use replace to prevent back button issues, remove refresh to avoid session issues
        router.replace(redirectPath);
      }, 800);
    } catch (error: any) {
      console.error('Verify OTP Error:', error);
      toast.error('Invalid code. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left: Hero matching home aesthetic */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=2070&auto=format&fit=crop"
              alt="Roorq Hero"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full p-10 md:p-14 text-white">
            <div className="inline-flex items-center gap-3 bg-white text-black px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-fit">
              <Sparkles className="w-4 h-4" />
              Roorq Weekly Drop
            </div>
            <div className="space-y-6">
              <h1 className="text-[13vw] md:text-[9rem] font-black uppercase leading-[0.85] tracking-tighter drop-shadow-2xl">
                <span className="block text-red-600">Roorq</span>
                <span className="block md:inline text-white">Access</span>
                <span className="block md:inline text-red-600">Pass</span>
              </h1>
              <p className="text-sm md:text-base max-w-xl font-mono uppercase tracking-widest text-white/80">
                Built like a US streetwear startup. COD-first. Zion-crafted. Stay ahead of every drop.
              </p>
              <div className="grid grid-cols-3 gap-3 text-xs font-black uppercase tracking-widest">
                {[
                  { label: 'Students', value: '50K+' },
                  { label: 'Campus Drops', value: '100+' },
                  { label: 'Trust Score', value: '4.9★' },
                ].map((item) => (
                  <div key={item.label} className="bg-white text-black px-4 py-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="text-2xl">{item.value}</div>
                    <div className="text-[10px]">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 w-fit">
                <Shield className="w-4 h-4 text-red-500" />
                Encrypted login • No password leaks • Human support on standby
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="flex items-center justify-center px-6 md:px-10 lg:px-12 py-12 bg-white">
          <div className="w-full max-w-xl border-2 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8 md:p-10 bg-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Roorq Access</p>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight mt-1">
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </h2>
              </div>
              <div className="flex gap-2 text-xs font-black uppercase tracking-[0.14em]">
                <button
                  onClick={() => {
                    setMode('signin');
                    setStep('input');
                    setOtp('');
                  }}
                  className={`px-3 py-1 border-2 transition ${
                    mode === 'signin'
                      ? 'bg-black text-white border-black'
                      : 'border-gray-300 hover:border-black'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMode('signup');
                    setStep('input');
                    setOtp('');
                  }}
                  className={`px-3 py-1 border-2 transition ${
                    mode === 'signup'
                      ? 'bg-black text-white border-black'
                      : 'border-gray-300 hover:border-black'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {step === 'input' ? (
              <>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-black bg-white text-black font-black uppercase tracking-widest hover:-translate-y-0.5 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `${mode === 'signin' ? 'Sign in' : 'Sign up'} with Google`}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-black" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-[0.24em] font-black">
                    <span className="px-3 bg-white text-gray-500">or continue with</span>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setMethod('email')}
                    className={`flex-1 py-2 px-4 border-2 transition-all flex items-center justify-center gap-2 uppercase text-xs font-black tracking-[0.14em] ${
                      method === 'email'
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 hover:border-black'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    onClick={() => setMethod('phone')}
                    className={`flex-1 py-2 px-4 border-2 transition-all flex items-center justify-center gap-2 uppercase text-xs font-black tracking-[0.14em] ${
                      method === 'phone'
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 hover:border-black'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    Phone
                  </button>
                </div>

                <form onSubmit={handleSendOTP} className="space-y-4">
                  {method === 'email' ? (
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-gray-600 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 border-2 border-black/20 rounded-none focus:outline-none focus:border-black focus:ring-2 focus:ring-black"
                        disabled={loading}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-gray-600 mb-2">
                        Phone Number
                      </label>
                      <div className="flex gap-2">
                        <div className="flex items-center px-4 py-3 border-2 border-black/20 bg-gray-50 text-gray-700 uppercase text-xs font-black">
                          +91
                        </div>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                          placeholder="999-999-9999"
                          maxLength={12}
                          className="flex-1 px-4 py-3 border-2 border-black/20 rounded-none focus:outline-none focus:border-black focus:ring-2 focus:ring-black"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 text-white py-3 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-[0.18em] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600">Verification Code</p>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">Enter the 6-digit code</h3>
                  <p className="text-sm text-gray-600 font-mono">
                    Sent to {method === 'email' ? email : formatPhoneNumber(phone)}
                  </p>
                  <button
                    onClick={() => {
                      setStep('input');
                      setOtp('');
                    }}
                    className="text-xs font-black uppercase tracking-[0.16em] text-blue-600 underline"
                  >
                    Change {method}
                  </button>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-4 mt-4">
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-4 text-center text-2xl font-black tracking-[0.5em] border-2 border-black/20 focus:outline-none focus:border-black focus:ring-2 focus:ring-black rounded-none"
                    disabled={loading}
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-black text-white py-3 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-[0.18em] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enter'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendOTP({ preventDefault: () => {} } as React.FormEvent)}
                    disabled={countdown > 0 || loading}
                    className="w-full text-xs font-black uppercase tracking-[0.16em] text-gray-600 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                  </button>
                </form>
              </>
            )}

            <p className="mt-8 text-[11px] text-gray-500 text-center leading-relaxed uppercase tracking-[0.16em]">
              By continuing, you agree to our Terms of Service and Privacy Policy. We never share your data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}