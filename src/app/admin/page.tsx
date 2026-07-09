import { buildAdminOverview } from '@/lib/admin/metricsService';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import type { AdminMetricValue } from '@/lib/api/contracts/admin';
import { AdminCharts } from './_components/AdminCharts';

// Authorization is enforced by the admin layout; data must be fresh per request.
export const dynamic = 'force-dynamic';

const CARD_LABELS: Array<{ key: keyof Awaited<ReturnType<typeof buildAdminOverview>>['cards']; label: string; hint?: string }> = [
  { key: 'users', label: 'משתמשים רשומים' },
  { key: 'onlineUsers', label: 'מחוברים עכשיו', hint: 'שחקני מרובה משתתפים פעילים' },
  { key: 'dailyActiveUsers', label: 'שחקנים פעילים היום' },
  { key: 'monthlyActiveUsers', label: 'שחקנים פעילים החודש' },
  { key: 'gamesToday', label: 'משחקי מרובה היום' },
  { key: 'multiplayerGames', label: 'סה״כ משחקי מרובה' },
  { key: 'totalQuestionsAnswered', label: 'תשובות שנענו' },
  { key: 'averageScore', label: 'זכייה ממוצעת (לוח תוצאות)' },
  { key: 'contactRequests', label: 'פניות צור קשר' },
  { key: 'revenue', label: 'הכנסות' },
  { key: 'premiumUsers', label: 'מנויי פרימיום' },
  { key: 'xpEarnedToday', label: 'XP שנצבר היום' }
];

function metricText(metric: AdminMetricValue): string {
  if (!metric.available) return '—';
  if (metric.unit === 'usd') return `$${metric.value.toLocaleString('en-US')}`;
  return metric.value.toLocaleString('en-US');
}

export default async function AdminDashboard() {
  const overview = await buildAdminOverview(getRepositoryProvider());

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>דשבורד</h1>
        <div className="admin-status-row">
          <span className={`admin-status-pill ${overview.serverStatus === 'ok' ? 'is-ok' : 'is-warn'}`}>
            שרת: {overview.serverStatus === 'ok' ? 'תקין' : 'ירידה בשירות'}
          </span>
          <span className="admin-status-pill">ספק נתונים: {overview.provider === 'database' ? 'Supabase' : 'מקומי'}</span>
        </div>
      </header>

      <div className="admin-cards">
        {CARD_LABELS.map(({ key, label, hint }) => {
          const metric = overview.cards[key];
          return (
            <div className="admin-card glass" key={key}>
              <small>{label}</small>
              <strong>{metricText(metric)}</strong>
              {!metric.available && <em className="admin-card-note">לא נמדד עדיין — {metric.reason}</em>}
              {metric.available && hint && <em className="admin-card-note">{hint}</em>}
            </div>
          );
        })}
      </div>

      <AdminCharts charts={overview.charts} />
    </section>
  );
}
