'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthService } from '@/lib/auth/authService';
import { AuthShell, AuthField, AuthMessage } from '../auth-ui/AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordForm({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && document.referrer.startsWith(window.location.origin) && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/login');
  }

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    // Arriving from the reset email creates a recovery session; if one exists we
    // let the user set a new password. Otherwise we show the request form.
    createAuthService()
      .getEmail()
      .then(value => {
        if (!active) return;
        setRecoveryMode(Boolean(value));
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function onRequest(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const result = await createAuthService().requestPasswordReset(email);
    setBusy(false);
    if (result.status === 'reset_sent') {
      setNotice(result.message || 'אם הכתובת קיימת, נשלח קישור לאיפוס סיסמה.');
      return;
    }
    setError(result.message || 'שליחת הקישור נכשלה.');
  }

  async function onUpdate(event: React.FormEvent) {
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
    const result = await createAuthService().updatePassword(password);
    setBusy(false);
    if (result.status === 'ok') {
      setNotice('הסיסמה עודכנה. מעביר להתחברות…');
      setTimeout(() => router.replace('/login'), 1200);
      return;
    }
    setError(result.message || 'עדכון הסיסמה נכשל.');
  }

  return (
    <AuthShell title="איפוס סיסמה" subtitle={recoveryMode ? 'בחרו סיסמה חדשה' : 'נשלח אליכם קישור לאיפוס'} onBack={handleBack}>
      {!supabaseConfigured && (
        <AuthMessage tone="warn">איפוס סיסמה אינו מופעל בסביבה זו. יש לחבר את Supabase Auth.</AuthMessage>
      )}

      {ready && recoveryMode ? (
        <form className="grid gap-4" onSubmit={onUpdate}>
          <AuthField label="סיסמה חדשה">
            <input className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
          </AuthField>
          <AuthField label="אימות סיסמה">
            <input className="form-input" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required disabled={busy} />
          </AuthField>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          {notice && <AuthMessage tone="success">{notice}</AuthMessage>}
          <button className="premium-button focus-ring w-full" type="submit" disabled={busy}>
            {busy ? 'מעדכן…' : 'עדכון סיסמה'}
          </button>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={onRequest}>
          <AuthField label="אימייל">
            <input className="form-input" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={!supabaseConfigured || busy} />
          </AuthField>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          {notice && <AuthMessage tone="success">{notice}</AuthMessage>}
          <button className="premium-button focus-ring w-full" type="submit" disabled={!supabaseConfigured || busy}>
            {busy ? 'שולח…' : 'שליחת קישור איפוס'}
          </button>
        </form>
      )}

    </AuthShell>
  );
}
