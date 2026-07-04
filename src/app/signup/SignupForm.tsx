'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createAuthService } from '@/lib/auth/authService';
import { AuthShell, AuthField, AuthMessage, GoogleButton } from '../auth-ui/AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function SignupForm({
  supabaseConfigured,
  emailPasswordEnabled
}: {
  supabaseConfigured: boolean;
  emailPasswordEnabled: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      setNotice('החשבון נוצר. אפשר להתחבר כעת.');
      return;
    }
    setError(result.message || 'ההרשמה נכשלה. נסו שוב.');
  }

  async function onGoogle() {
    setBusy(true);
    setError('');
    const result = await createAuthService().signInWithGoogle();
    if (result.status !== 'ok') {
      setError(result.message || 'התחברות Google נכשלה.');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="יצירת חשבון" subtitle="הרשמה לאזור המנהלים">
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
            {busy ? 'יוצר חשבון…' : 'הרשמה'}
          </button>
        </form>
      )}

      <GoogleButton label="הרשמה עם Google" onClick={onGoogle} disabled={!supabaseConfigured || busy} />

      <div className="auth-links">
        <Link className="focus-ring" href="/login">כבר יש לי חשבון</Link>
        <Link className="focus-ring" href="/reset-password">שכחתי סיסמה</Link>
      </div>
    </AuthShell>
  );
}
