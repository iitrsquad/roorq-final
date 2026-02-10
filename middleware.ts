import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const IDLE_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;
const LAST_SEEN_REFRESH_SECONDS = 5 * 60;

const buildFingerprint = async (ip: string, userAgent: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}|${userAgent}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Skip auth check for API routes and public assets
  if (pathname.startsWith('/api/')) {
    return response;
  }

  // Only process auth for non-static files and non-API routes
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Preserve existing cookies and set proper path/domain
          request.cookies.set({
            name,
            value,
            ...options,
            path: '/', // Ensure cookies are available across all routes
            sameSite: 'lax' as const, // Better for navigation
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
            path: '/', // Ensure cookies are available across all routes
            sameSite: 'lax' as const,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
            path: '/',
            sameSite: 'lax' as const,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
            path: '/',
            sameSite: 'lax' as const,
          });
        },
      },
    }
  );

  // Refreshing the auth token with proper error handling
  // This prevents session invalidation on network errors or temporary issues
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (user) {
      const now = Date.now();
      const lastSeenRaw = request.cookies.get('auth_last_seen')?.value;
      const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : null;

      if (lastSeen && Number.isFinite(lastSeen)) {
        const idleSeconds = Math.floor((now - lastSeen) / 1000);
        if (idleSeconds > IDLE_TIMEOUT_SECONDS) {
          await supabase.auth.signOut();
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/auth';
          redirectUrl.searchParams.set('error', 'session_expired');

          response = NextResponse.redirect(redirectUrl);
          response.cookies.set('auth_last_seen', '', {
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            httpOnly: true,
          });
          response.cookies.set('auth_fingerprint', '', {
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            httpOnly: true,
          });
          return response;
        }
      }

      const shouldRefreshLastSeen =
        !lastSeen || !Number.isFinite(lastSeen) || (now - (lastSeen || 0)) / 1000 > LAST_SEEN_REFRESH_SECONDS;

      if (shouldRefreshLastSeen) {
        response.cookies.set('auth_last_seen', `${now}`, {
          maxAge: IDLE_TIMEOUT_SECONDS,
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
        });
      }

      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const userAgent = request.headers.get('user-agent') || '';
      const fingerprint = await buildFingerprint(ip, userAgent);
      const storedFingerprint = request.cookies.get('auth_fingerprint')?.value;

      if (storedFingerprint && storedFingerprint !== fingerprint) {
        response.cookies.set('auth_suspicious', '1', {
          maxAge: 60 * 60,
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
        });
      } else if (!storedFingerprint) {
        response.cookies.set('auth_fingerprint', fingerprint, {
          maxAge: IDLE_TIMEOUT_SECONDS,
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
        });
      }
    }
    if (!user) {
      return response;
    }
  } catch (error) {
    // Catch any unexpected errors and continue
    // This ensures navigation never breaks due to auth issues
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
