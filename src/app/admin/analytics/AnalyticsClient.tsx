'use client';

import { useEffect, useState } from 'react';
import type { AdminAnalytics } from '@/lib/admin/analyticsService';

/** Business analytics console over real repository data. */
export function AnalyticsClient() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/analytics', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!active) return;
        if (data?.ok) setAnalytics(data.analytics);
        else setMessage(data?.error || 'טעינת האנליטיקות נכשלה.');
      })
      .catch(() => active && setMessage('טעינת האנליטיקות נכשלה.'));
    return () => { active = false; };
  }, []);

  if (message) return <section className="admin-page"><div className="form-error" role="alert">{message}</div></section>;
  if (!analytics) return <section className="admin-page"><div className="admin-empty glass">טוען אנליטיקות...</div></section>;

  const engagementCards = [
    { label: 'שחקנים פעילים היום', value: String(analytics.engagement.dailyActivePlayers) },
    { label: 'שחקנים פעילים החודש', value: String(analytics.engagement.monthlyActivePlayers) },
    { label: 'דביקות (DAU/MAU)', value: analytics.engagement.stickiness != null ? `${analytics.engagement.stickiness}%` : '—' },
    { label: 'משחקים לשחקן (ממוצע)', value: analytics.engagement.averageGamesPerPlayer != null ? String(analytics.engagement.averageGamesPerPlayer) : '—' },
    { label: 'XP לשחקן (ממוצע)', value: analytics.engagement.averageXpPerPlayer != null ? analytics.engagement.averageXpPerPlayer.toLocaleString('en-US') : '—' },
    { label: 'המרת פרימיום', value: analytics.premium.conversionRate != null ? `${analytics.premium.conversionRate}%` : '—' }
  ];

  const maxFunnel = Math.max(1, ...analytics.multiplayerFunnel.map(step => step.value));

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1>אנליטיקות</h1>
        <span className="admin-status-pill">עודכן: {new Date(analytics.generatedAt).toLocaleTimeString('he-IL')}</span>
      </header>

      <div className="admin-cards">
        {engagementCards.map(card => (
          <div className="admin-card glass" key={card.label}>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-chart-grid">
        <div className="admin-chart glass">
          <h3>משפך מרובה משתתפים</h3>
          <ul className="admin-funnel">
            {analytics.multiplayerFunnel.map(step => (
              <li key={step.name}>
                <span className="admin-bar-label">{step.name}</span>
                <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${Math.max(3, (step.value / maxFunnel) * 100)}%` }} /></span>
                <span className="admin-bar-value">{step.value}{step.ratioOfPrevious != null ? ` (${step.ratioOfPrevious}%)` : ''}</span>
              </li>
            ))}
          </ul>
          <p className="admin-muted">נטישה: {analytics.lobbyDropOff.neverStarted} מתוך {analytics.lobbyDropOff.created} חדרים לא הגיעו למשחק{analytics.lobbyDropOff.dropOffRate != null ? ` (${analytics.lobbyDropOff.dropOffRate}%)` : ''}.</p>
        </div>

        <div className="admin-chart glass">
          <h3>הכנסות ופרימיום</h3>
          <div className="admin-detail-grid">
            <div><small>הכנסות שהושלמו</small><strong>${analytics.premium.completedRevenue.toLocaleString('en-US')}</strong></div>
            <div><small>מנויים פעילים</small><strong>{analytics.premium.activeSubscriptions}</strong></div>
            <div><small>שחקנים פעילים</small><strong>{analytics.premium.activePlayers}</strong></div>
          </div>
        </div>

        <div className="admin-chart glass">
          <h3>פופולריות קטגוריות (מאגר)</h3>
          <ul className="admin-bars">
            {analytics.categoryPopularity.map(item => {
              const max = Math.max(1, ...analytics.categoryPopularity.map(entry => entry.value));
              return (
                <li key={item.name}>
                  <span className="admin-bar-label">{item.name}</span>
                  <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></span>
                  <span className="admin-bar-value">{item.value.toLocaleString('en-US')}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="admin-chart glass">
          <h3>התפלגות זכיות (לוח התוצאות)</h3>
          <ul className="admin-bars">
            {analytics.prizeDistribution.map(item => {
              const max = Math.max(1, ...analytics.prizeDistribution.map(entry => entry.value));
              return (
                <li key={item.name}>
                  <span className="admin-bar-label">{item.name}</span>
                  <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></span>
                  <span className="admin-bar-value">{item.value}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <h2 className="admin-subheading">לא נמדד עדיין</h2>
      <ul className="admin-unavailable">
        {Object.entries(analytics.unavailable).map(([key, reason]) => (
          <li key={key}>
            <strong>{key === 'sessionDuration' ? 'משך סשן' : key === 'retentionCohorts' ? 'קוהורטות שימור' : key === 'screenFunnels' ? 'משפכי מסכים' : 'הכנסות מפרסומות'}</strong>
            <small>{reason}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
