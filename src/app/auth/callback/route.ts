import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabaseServerClient';

/**
 * OAuth and email-confirmation callback. Supabase redirects here with a `code`
 * which is exchanged for a session cookie, then the user is sent on to their
 * intended destination (defaults to the public home page).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const redirectParam = url.searchParams.get('redirect');
  const destination = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/';

  const supabase = await createServerSupabaseClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destination, url.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));
}
