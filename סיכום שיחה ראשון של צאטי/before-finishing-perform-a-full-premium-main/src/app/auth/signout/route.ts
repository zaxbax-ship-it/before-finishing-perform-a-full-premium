import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabaseServerClient';

/**
 * Signs the current user out (clears the Supabase session cookie) and returns
 * them to the login screen. POST-only to avoid CSRF-style navigation logout.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/login', new URL(request.url).origin), { status: 303 });
}
