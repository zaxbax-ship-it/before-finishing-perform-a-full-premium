import Link from 'next/link';
import { AuthShell, AuthMessage } from '../auth-ui/AuthShell';

export const metadata = { title: 'אין הרשאה · משחק השעשועון' };

export default function ForbiddenPage() {
  return (
    <AuthShell title="אין הרשאה" subtitle="החשבון שלך מחובר אך אינו מורשה לאזור זה">
      <AuthMessage tone="warn">
        רק מנהלים מורשים יכולים לגשת לאזור הניהול. אם לדעתך זו טעות, פנו למנהל המערכת כדי לקבל הרשאה.
      </AuthMessage>
      <div className="auth-actions">
        <Link className="premium-button focus-ring w-full" href="/">חזרה למשחק</Link>
        <form action="/auth/signout" method="post">
          <button className="ghost-button focus-ring w-full" type="submit">התנתקות</button>
        </form>
      </div>
    </AuthShell>
  );
}
