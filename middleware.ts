import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Skip auth check for API routes - they handle their own authentication
  // This prevents unnecessary session checks and confusing error messages
  if (request.nextUrl.pathname.startsWith('/api/')) {
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
    
    // Only log errors for debugging, don't break the request flow
    // Common expected errors (no session for logged-out users) are silent
    if (error) {
      // These are expected errors for logged-out users - don't log them
      const expectedErrors = [
        'Invalid Refresh Token: Refresh Token Not Found',
        'Auth session missing!',
        'JWT expired',
        'Invalid Refresh Token',
      ];
      
      // Only log unexpected errors (not the common "no session" cases)
      if (!expectedErrors.some(msg => error.message.includes(msg))) {
        // This is an unexpected error - log it for debugging
        console.debug('Middleware auth check (unexpected error):', error.message);
      }
      // Otherwise, silently continue - this is normal for logged-out users
    }
  } catch (error) {
    // Catch any unexpected errors and continue
    // This ensures navigation never breaks due to auth issues
    console.debug('Middleware auth error (non-blocking):', error);
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
