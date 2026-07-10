'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PlayerRewardsInspection, RewardsHealthDto } from '@/lib/admin/rewardsAdminService';

/**
 * Admin Console — reward management. Health/observability + per-player
 * entitlement and Career-Earnings ledger inspection, with secure, audit-logged
 * grant/revoke. Every write hits the server (rewards.manage); the API is the
 * only authority. Dollars only — the sole monetary grant is a Career-Earnings
 * adjustment.
 */

type GrantKind = 'cosmetic' | 'title' | 'badge' | 'career-adjustment';

const KIND_LABEL: Record<GrantKind, string> = {
  cosmetic: 'קוסמטיקה',
  title: 'תואר',
  badge: 'תג',
  'career-adjustment': 'התאמת רווחי קריירה ($)'
};

function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export function RewardsAdminClient() {
  const [overview, setOverview] = useState<RewardsHealthDto | null>(null);
  const [playerKey, setPlayerKey] = useState('');
  const [inspection, setInspection] = useState<PlayerRewardsInspection | null>(null);
  const [kind, setKind] = useState<GrantKind>('cosmetic');
  const [itemId, setItemId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/rewards', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) setOverview(data);
      else setMessage(data?.error || 'טעינת הנתונים נכשלה.');
    } catch {
      setMessage('טעינת הנתונים נכשלה.');
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const lookup = useCallback(async (key: string) => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rewards?playerKey=${encodeURIComponent(key.trim())}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setInspection(data.inspection);
        setMessage('');
      } else {
        setMessage(data?.error || 'טעינת השחקן נכשלה.');
      }
    } catch {
      setMessage('טעינת השחקן נכשלה.');
    } finally {
      setBusy(false);
    }
  }, []);

  async function submit(action: 'grant' | 'revoke') {
    if (!playerKey.trim()) {
      setMessage('נדרש מזהה שחקן.');
      return;
    }
    let request: Record<string, unknown>;
    if (kind === 'career-adjustment') {
      if (action === 'revoke') {
        setMessage('לא ניתן לשלול התאמת רווחים; בצע התאמה נגדית.');
        return;
      }
      request = { kind, amount: Number(amount), reason: reason || 'admin adjustment' };
    } else {
      const field = kind === 'cosmetic' ? 'cosmeticId' : kind === 'title' ? 'titleId' : 'badgeId';
      request = { kind, [field]: itemId.trim() };
    }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerKey: playerKey.trim(), request })
      });
      const data = await response.json();
      if (response.ok && data?.ok) {
        setInspection(data.inspection);
        setMessage(action === 'grant' ? 'הוענק בהצלחה.' : 'נשלל בהצלחה.');
        setItemId('');
        setAmount('');
        setReason('');
        await loadOverview();
      } else {
        setMessage(data?.error || 'הפעולה נכשלה.');
      }
    } catch {
      setMessage('הפעולה נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  if (!overview) {
    return <section className="admin-page"><div className="admin-empty glass">טוען נתוני תגמולים...</div></section>;
  }

  const cards: Array<{ label: string; value: string }> = [
    { label: 'ספק אחסון', value: overview.provider === 'supabase' ? 'Supabase' : 'מקומי (זמני)' },
    { label: 'מטבע', value: `${overview.economy.currency} · ללא מטבע נוסף` },
    { label: 'תארים', value: String(overview.catalogue.titles) },
    { label: 'תגים', value: String(overview.catalogue.badges) },
    { label: 'קוסמטיקה', value: String(overview.catalogue.cosmetics) },
    { label: 'משימות שבועיות', value: String(overview.catalogue.weeklyObjectives) }
  ];

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>ניהול תגמולים</h1>
        <span className="admin-status-pill">עודכן: {new Date(overview.generatedAt).toLocaleTimeString('he-IL')}</span>
      </header>

      {message && <div className="form-error" role="status">{message}</div>}

      <div className="admin-cards">
        {cards.map(card => (
          <div className="admin-card glass" key={card.label}>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <h2 className="admin-subheading">בדיקת שחקן</h2>
      <div className="admin-table-wrap glass" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          placeholder="מזהה שחקן (playerKey)"
          value={playerKey}
          onChange={event => setPlayerKey(event.target.value)}
          style={{ minWidth: 240 }}
        />
        <button className="premium-button focus-ring" disabled={busy} onClick={() => void lookup(playerKey)}>טען</button>
      </div>

      {inspection && (
        <>
          <h2 className="admin-subheading">רווחי קריירה — {inspection.identity.displayName || inspection.playerKey}</h2>
          <div className="admin-cards">
            <div className="admin-card glass"><small>סה״כ לכל החיים</small><strong>{usd(inspection.career.lifetimeTotal)}</strong></div>
            <div className="admin-card glass"><small>יתרה זמינה</small><strong>{usd(inspection.career.spendableBalance)}</strong></div>
            <div className="admin-card glass"><small>משחק הכי טוב</small><strong>{usd(inspection.career.bestSingleGame)}</strong></div>
            <div className="admin-card glass"><small>ניצחונות</small><strong>{inspection.career.gamesWon}</strong></div>
            <div className="admin-card glass"><small>תארים</small><strong>{inspection.titles.length}</strong></div>
            <div className="admin-card glass"><small>תגים</small><strong>{inspection.unlockedBadges.length}</strong></div>
          </div>

          <h2 className="admin-subheading">הענקה / שלילה</h2>
          <div className="admin-table-wrap glass" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-input" value={kind} onChange={event => setKind(event.target.value as GrantKind)}>
              {(Object.keys(KIND_LABEL) as GrantKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            {kind === 'career-adjustment' ? (
              <>
                <input className="form-input" placeholder="סכום ($, שלילי לחיוב)" value={amount} onChange={event => setAmount(event.target.value)} style={{ minWidth: 160 }} />
                <input className="form-input" placeholder="סיבה" value={reason} onChange={event => setReason(event.target.value)} style={{ minWidth: 200 }} />
              </>
            ) : (
              <input className="form-input" placeholder="מזהה פריט" value={itemId} onChange={event => setItemId(event.target.value)} style={{ minWidth: 200 }} />
            )}
            <button className="premium-button focus-ring" disabled={busy} onClick={() => void submit('grant')}>הענק</button>
            {kind !== 'career-adjustment' && (
              <button className="ghost-button focus-ring" disabled={busy} onClick={() => void submit('revoke')}>שלול</button>
            )}
          </div>

          <h2 className="admin-subheading">יומן רווחי קריירה</h2>
          {inspection.career.ledger.length === 0 ? (
            <div className="admin-empty glass">אין רשומות יומן.</div>
          ) : (
            <div className="admin-table-wrap glass">
              <table className="admin-table">
                <thead><tr><th>סוג</th><th>סכום</th><th>מפתח ייחוד</th><th>תאריך</th></tr></thead>
                <tbody>
                  {inspection.career.ledger.slice(0, 50).map(entry => (
                    <tr key={entry.id}>
                      <td>{entry.kind}</td>
                      <td>{usd(entry.amount)}</td>
                      <td>{entry.idempotencyKey}</td>
                      <td>{new Date(entry.createdAt).toLocaleString('he-IL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 className="admin-subheading">פעולות מנהל אחרונות</h2>
      {overview.recentAdminActions.length === 0 ? (
        <div className="admin-empty glass">לא בוצעו פעולות תגמול.</div>
      ) : (
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead><tr><th>פעולה</th><th>מנהל</th><th>שחקן</th><th>מתי</th></tr></thead>
            <tbody>
              {overview.recentAdminActions.map((action, index) => (
                <tr key={`${action.at}-${index}`}>
                  <td>{action.action === 'admin_rewards_grant' ? 'הענקה' : 'שלילה'}</td>
                  <td>{action.actor}</td>
                  <td>{action.playerKey}</td>
                  <td>{new Date(action.at).toLocaleString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
