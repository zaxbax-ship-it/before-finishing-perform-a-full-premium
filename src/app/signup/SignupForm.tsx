'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAuthService } from '@/lib/auth/authService';
import { AuthShell, AuthField, AuthMessage, GoogleButton } from '../auth-ui/AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function SignupForm({
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
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function redirectTarget() {
    if (typeof window === 'undefined') return '/';
    const target = new URLSearchParams(window.location.search).get('redirect');
    return target && target.startsWith('/') ? target : '/';
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }
    setBusy(true);
    const result = await createAuthService().signUpWithEmail(email, password);
    setBusy(false);
    if (result.status === 'verification_sent') {
      setNotice('נשלח אליך אימייל אימות. אשרו את הכתובת כדי להשלים את ההרשמה.');
      return;
    }
    if (result.status === 'ok') {
      router.replace(redirectTarget());
      router.refresh();
      return;
    }
    setError(result.message || 'ההרשמה נכשלה. נסו שוב.');
  }

  async function onGoogle() {
    if (!googleOAuthConfigured) {
      setError('הרשמה עם Google עדיין לא הופעלה. אפשר להירשם כרגע באמצעות אימייל וסיסמה.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await createAuthService().signInWithGoogle();
    if (result.status !== 'ok') {
      setError(result.message || 'הרשמה עם Google נכשלה.');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="יצירת חשבון" subtitle="שמרו התקדמות, כינוי, סטטיסטיקות ודירוגים">
      {!supabaseConfigured && (
        <AuthMessage tone="warn">
          הרשמה אינה מופעלת בסביבה זו. יש לחבר את Supabase Auth כדי ליצור חשבון.
        </AuthMessage>
      )}

      {emailPasswordEnabled && (
        <form className="grid gap-4" onSubmit={onSubmit}>
          <AuthField label="אימייל">
            <input className="form-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={!supabaseConfigured || busy} />
          </AuthField>
          <AuthField label="סיסמה">
            <input className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={!supabaseConfigured || busy} />
          </AuthField>
          <AuthField label="אימות סיסמה">
            <input className="form-input" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required disabled={!supabaseConfigured || busy} />
          </AuthField>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          {notice && <AuthMessage tone="success">{notice}</AuthMessage>}
          <button className="premium-button focus-ring w-full" type="submit" disabled={!supabaseConfigured || busy}>
            {busy ? 'יוצר חשבון...' : 'הרשמה'}
          </button>
        </form>
      )}

      {googleOAuthConfigured && <GoogleButton label="הרשמה עם Google" onClick={onGoogle} disabled={!supabaseConfigured || busy} />}
      {!googleOAuthConfigured && supabaseConfigured && (
        <AuthMessage tone="warn">
          הרשמה עם Google תוכן בהמשך. בינתיים אפשר ליצור חשבון באימייל וסיסמה.
        </AuthMessage>
      )}

      <div className="auth-links">
        <button type="button" className="focus-ring" onClick={handleBack}>חזרה</button>
        <Link className="focus-ring" href="/login">כבר יש לי חשבון</Link>
        <Link className="focus-ring" href="/reset-password">שכחתי סיסמה</Link>
      </div>
    </AuthShell>
  );
}
