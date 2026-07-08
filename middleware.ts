import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isAuthEnforced,
  isSupabaseAuthConfigured
} from '@/lib/auth/config';

/**
 * Global middleware.
 *
 * Responsibilities (edge-safe — no database / repository access here):
 *  1. Refresh the Supabase Auth session cookie on every matched request so
 *     login persists across navigations.
 *  2. Coarse route protection: when enforcement is active, unauthenticated
 *     users are redirected away from `/admin` to `/login`. Fine-grained
 *     permission checks run server-side in the page / route handlers.
 */
export async function middleware(request: NextRequest) {
  // No Supabase Auth configured: open mode is allowed only outside production.
  // In a production runtime the admin area fails closed at the edge as well
  // (the /admin page and admin APIs enforce the same rule server-side).
  if (!isSupabaseAuthConfigured()) {
    if (process.env.NODE_ENV === 'production' && request.nextUrl.pathname.startsWith('/admin')) {
      const forbiddenUrl = request.nextUrl.clone();
      forbiddenUrl.pathname = '/forbidden';
      forbiddenUrl.search = '';
      return NextResponse.redirect(forbiddenUrl);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl() as string, getSupabaseAnonKey() as string, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (isAuthEnforced() && !user && request.nextUrl.pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?redirect=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets so the session
  // cookie is refreshed app-wide while keeping the middleware cheap.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|ttf|woff|woff2)$).*)']
};
