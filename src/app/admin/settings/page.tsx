import { getProductionConfig } from '@/lib/infrastructure/config';
import { describeEmailConfig } from '@/lib/email';
import { getAdminAllowlist, getSiteUrl, isAuthEnforced } from '@/lib/auth/config';
import { MONEY, SAFE_STEPS, SOLO_TIMER_SECONDS, LANGUAGE_OPTIONS } from '@/components/trivia/constants';
import { EXTRA_LIFE_POT_FRACTION, SOLO_INITIAL_LIVES } from '@/lib/gameplay/economy';

// Authorization is enforced by the admin layout.
export const dynamic = 'force-dynamic';

type SettingRow = { label: string; value: string; note?: string };
type SettingsSection = { title: string; rows: SettingRow[] };

/**
 * System configuration console — a truthful, read-only view of the runtime
 * configuration: gameplay rules come from the shared code constants (the same
 * single source of truth the game uses), infrastructure from the config layer
 * (presence only — secret values are never rendered). Runtime configuration
 * is environment-driven (12-factor): changing it means updating env vars and
 * redeploying, which is stated up front instead of offering fake toggles.
 */
export default function AdminSettingsPage() {
  const config = getProductionConfig();
  const email = describeEmailConfig();
  const allowlist = getAdminAllowlist();

  const yes = 'מוגדר';
  const no = 'לא מוגדר';

  const sections: SettingsSection[] = [
    {
      title: 'כללי',
      rows: [
        { label: 'כתובת האתר', value: getSiteUrl() },
        { label: 'סביבת ריצה', value: config.environment.runtime },
        { label: 'ספק נתונים', value: config.database.mode === 'supabase' ? 'Supabase' : 'JSON מקומי' }
      ]
    },
    {
      title: 'משחקיות',
      rows: [
        { label: 'זמן לשאלה (יחיד)', value: `${SOLO_TIMER_SECONDS} שניות` },
        { label: 'חיים התחלתיים', value: String(SOLO_INITIAL_LIVES) },
        { label: 'מדרגות בסולם', value: String(MONEY.length) },
        { label: 'מדרגות בטוחות', value: SAFE_STEPS.join(', '), note: 'אינדקסים בסולם הפרסים' }
      ]
    },
    {
      title: 'כלכלה',
      rows: [
        { label: 'פרס מרבי', value: `$${MONEY[MONEY.length - 1].toLocaleString('en-US')}` },
        { label: 'מחיר חיים נוספים', value: `${EXTRA_LIFE_POT_FRACTION * 100}% מהקופה הנוכחית` },
        { label: 'מחיר שימוש חוזר בעזר', value: 'מחיר קבוע לפי עזר, מוגבל ל־25% מהקופה' }
      ]
    },
    {
      title: 'לוקליזציה',
      rows: [
        { label: 'שפות נתמכות', value: LANGUAGE_OPTIONS.map(option => option.native).join(' · ') },
        { label: 'שפת ברירת מחדל', value: 'עברית (RTL)' }
      ]
    },
    {
      title: 'אימייל',
      rows: [
        { label: 'ספק אימייל', value: email.provider === 'resend' ? 'Resend' : 'ללא (no-op מדווח)' },
        { label: 'תיבת יעד לפניות', value: email.notifyEmailConfigured ? yes : no },
        { label: 'שולח מאומת', value: email.fromEmailConfigured ? yes : no, note: 'ללא שולח מאומת, Resend מוגבל לתיבת בעל החשבון' }
      ]
    },
    {
      title: 'פרסומות',
      rows: [
        { label: 'פרסומות', value: config.ads.enabled ? 'מופעלות' : 'כבויות' },
        { label: 'ספק פרסומות', value: config.ads.provider === 'none' ? 'ללא' : config.ads.provider }
      ]
    },
    {
      title: 'אנליטיקס',
      rows: [
        { label: 'ספק אנליטיקס', value: config.analytics.provider === 'none' ? 'ללא' : config.analytics.provider },
        { label: 'Sentry', value: config.observability.sentryConfigured ? yes : no }
      ]
    },
    {
      title: 'פרימיום ותשלומים',
      rows: [
        { label: 'Stripe', value: config.payments.stripeConfigured ? yes : no },
        { label: 'Lemon Squeezy', value: config.payments.lemonSqueezyConfigured ? yes : no }
      ]
    },
    {
      title: 'אבטחה',
      rows: [
        { label: 'אכיפת אימות', value: isAuthEnforced() ? 'פעילה' : 'כבויה (נעילה אוטומטית בפרודקשן)' },
        { label: 'מנהלים ברשימת ההיתר', value: String(allowlist.length), note: 'ADMIN_EMAILS' },
        { label: 'הגבלת קצב מבוזרת', value: config.rateLimiting.distributed ? yes : 'זיכרון מקומי', note: config.rateLimiting.reason },
        { label: 'Google OAuth', value: config.auth.googleOAuthConfigured ? yes : no }
      ]
    }
  ];

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>הגדרות מערכת</h1>
      </header>
      <p className="admin-muted">
        התצורה מנוהלת דרך משתני סביבה (12-factor) וקבועי קוד משותפים — שינוי מחייב עדכון env ופריסה מחדש.
        ערכים סודיים לעולם אינם מוצגים; רק נוכחות התצורה.
      </p>
      <div className="admin-settings-grid">
        {sections.map(section => (
          <div className="admin-chart glass" key={section.title}>
            <h3>{section.title}</h3>
            <ul className="admin-settings-list">
              {section.rows.map(row => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  {row.note && <small className="admin-muted">{row.note}</small>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
