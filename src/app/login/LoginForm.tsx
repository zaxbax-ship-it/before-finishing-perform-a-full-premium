'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAuthService } from '@/lib/auth/authService';
import { AuthShell, AuthField, AuthMessage, GoogleButton } from '../auth-ui/AuthShell';

export default function LoginForm({
  supabaseConfigured,
  emailPasswordEnabled,
  googleOAuthConfigured
}: {
  supabaseConfigured: boolean;
  emailPasswordEnabled: boolean;
  googleOAuthConfigured: boolean;
}) {
  const router = useRouter();

  function handleBack() {
    // Prefer real history when the user arrived from inside the site;
    // otherwise (direct URL / external referrer) fall back to home.
    if (document.referrer.startsWith(window.location.origin) && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function redirectTarget() {
    if (typeof window === 'undefined') return '/';
    const target = new URLSearchParams(window.location.search).get('redirect');
    return target && target.startsWith('/') ? target : '/';
  }

  async function onPasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await createAuthService().signInWithPassword(email, password);
    if (result.status === 'ok') {
      router.replace(redirectTarget());
      router.refresh();
      return;
    }
    setError(result.message || 'ההתחברות נכשלה. בדקו את הפרטים ונסו שוב.');
    setBusy(false);
  }

  async function onGoogle() {
    if (!googleOAuthConfigured) {
      setError('כניסה עם Google עדיין לא הופעלה. אפשר להתחבר כרגע באמצעות אימייל וסיסמה.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await createAuthService().signInWithGoogle();
    if (result.status !== 'ok') {
      setError(result.message || 'התחברות עם Google נכשלה.');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="כניסה לחשבון" subtitle="חזרו למשחק, לסטטיסטיקות וללוח השיאים שלכם">
      {!supabaseConfigured && (
        <AuthMessage tone="warn">
          התחברות אינה מופעלת בסביבה זו. יש לחבר את Supabase Auth כדי להתחבר.
        </AuthMessage>
      )}

      {emailPasswordEnabled && (
        <form className="grid gap-4" onSubmit={onPasswordSubmit}>
          <AuthField label="אימייל">
            <input
              className="form-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
              disabled={!supabaseConfigured || busy}
            />
          </AuthField>
          <AuthField label="סיסמה">
            <input
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
              disabled={!supabaseConfigured || busy}
            />
          </AuthField>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <button className="premium-button focus-ring w-full" type="submit" disabled={!supabaseConfigured || busy}>
            {busy ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      )}

      {googleOAuthConfigured && <GoogleButton label="כניסה עם Google" onClick={onGoogle} disabled={!supabaseConfigured || busy} />}
      {!googleOAuthConfigured && supabaseConfigured && (
        <AuthMessage tone="warn">
          כניסה עם Google תוכן בהמשך. בינתיים אפשר להתחבר באימייל וסיסמה.
        </AuthMessage>
      )}

      <div className="auth-links">
        <button type="button" className="focus-ring" onClick={handleBack}>חזרה</button>
        <Link className="focus-ring" href="/reset-password">שכחתי סיסמה</Link>
        <Link className="focus-ring" href="/signup">יצירת חשבון</Link>
      </div>
    </AuthShell>
  );
}
