'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminHealthReport } from '@/lib/admin/healthAdminService';

const STATUS_HE: Record<string, string> = { ok: 'תקין', degraded: 'ירידה בשירות', down: 'תקלה', not_configured: 'לא מוגדר' };

function statusClass(status: string): string {
  return status === 'ok' ? 'is-ok' : status === 'down' ? 'is-danger' : status === 'degraded' ? 'is-warn' : '';
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}ש ${minutes}ד` : `${minutes}ד ${seconds % 60}ש׳`;
}

/** System health console: platform checks + live dependency probes with latency. */
export function HealthClient() {
  const [report, setReport] = useState<AdminHealthReport | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/health', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setReport(data.report);
        setMessage('');
        return;
      }
      setMessage(data?.error || 'טעינת נתוני הבריאות נכשלה.');
    } catch {
      setMessage('טעינת נתוני הבריאות נכשלה.');
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (message) return <section className="admin-page"><div className="form-error" role="alert">{message}</div></section>;
  if (!report) return <section className="admin-page"><div className="admin-empty glass">בודק את המערכת...</div></section>;

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>בריאות המערכת</h1>
        <div className="admin-status-row">
          <span className={`admin-status-pill ${statusClass(report.overall)}`}>מצב כללי: {STATUS_HE[report.overall]}</span>
          <span className="admin-status-pill">זמן פעילות: {formatUptime(report.uptimeSeconds)}</span>
          <span className="admin-status-pill">מיגרציות: עד {report.startup.expectedMigrationVersion}</span>
        </div>
      </header>

      <div className="admin-cards">
        <div className="admin-card glass">
          <small>ספק נתונים פעיל</small>
          <strong>{report.startup.activeProvider === 'database' ? 'Supabase' : 'JSON מקומי'}</strong>
          <em className="admin-card-note">מצב מבוקש: {report.startup.databaseMode}{report.startup.productionMisconfigured ? ' · תצורה שגויה בפרודקשן!' : ''}</em>
        </div>
        <div className="admin-card glass">
          <small>משתני סביבה חסרים</small>
          <strong>{report.startup.missingEnv.length}</strong>
          {report.startup.missingEnv.length > 0 && <em className="admin-card-note" dir="ltr">{report.startup.missingEnv.join(', ')}</em>}
        </div>
      </div>

      <h2 className="admin-subheading">בדיקות תלות חיות</h2>
      <div className="admin-table-wrap glass">
        <table className="admin-table">
          <thead><tr><th>שירות</th><th>סטטוס</th><th>זמן תגובה</th><th>פרטים</th></tr></thead>
          <tbody>
            {report.probes.map(probe => (
              <tr key={probe.name}>
                <td dir="ltr"><strong>{probe.name}</strong></td>
                <td><span className={`admin-tag ${statusClass(probe.status)}`}>{STATUS_HE[probe.status]}</span></td>
                <td>{probe.latencyMs != null ? `${probe.latencyMs}ms` : '—'}</td>
                <td className="admin-muted">{probe.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="admin-subheading">בדיקות פלטפורמה</h2>
      <ul className="admin-audit-mini">
        {report.checks.map(check => (
          <li key={check.name}>
            <span><span className={`admin-tag ${statusClass(check.status)}`}>{STATUS_HE[check.status]}</span> {check.name}</span>
            <small>{check.message}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
