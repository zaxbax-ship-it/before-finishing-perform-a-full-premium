'use client';

import { useState } from 'react';
import type { AdminBreakdown, AdminChart, AdminOverviewCharts } from '@/lib/api/contracts/admin';

/**
 * Dependency-free interactive SVG charts for the admin console. Time series
 * render as area/line charts with a hover readout; breakdowns render as
 * horizontal bars. Unavailable datasets render an honest empty state with the
 * reason reported by the metrics service.
 */

const SERIES_CHARTS: Array<{ key: keyof AdminOverviewCharts; label: string }> = [
  { key: 'usersOverTime', label: 'שחקנים חדשים לאורך זמן (30 יום)' },
  { key: 'gamesOverTime', label: 'משחקי מרובה לאורך זמן (30 יום)' },
  { key: 'revenueOverTime', label: 'עסקאות לאורך זמן (30 יום)' },
  { key: 'multiplayerActivity', label: 'חדרי מרובה שנפתחו (30 יום)' },
  { key: 'retention', label: 'שימור שחקנים' }
];

const BREAKDOWN_CHARTS: Array<{ key: keyof AdminOverviewCharts; label: string }> = [
  { key: 'categoryPopularity', label: 'קטגוריות (מאגר השאלות)' },
  { key: 'questionDifficulty', label: 'רמות קושי (מאגר השאלות)' },
  { key: 'languages', label: 'שפות (חדרי מרובה)' },
  { key: 'deviceDistribution', label: 'התפלגות מכשירים' },
  { key: 'countries', label: 'מדינות' }
];

function LineChart({ chart }: { chart: AdminChart }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!chart.available) return <EmptyChart reason={chart.reason} />;

  const points = chart.points;
  const max = Math.max(1, ...points.map(point => point.value));
  const width = 560;
  const height = 150;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const y = (value: number) => height - 12 - (value / max) * (height - 30);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="admin-chart-canvas" dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="גרף קווי" preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={event => {
          const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          setHover(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
        }}>
        <path d={area} fill="rgba(69,194,255,0.14)" />
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={hover * step} x2={hover * step} y1={8} y2={height} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
            <circle cx={hover * step} cy={y(points[hover].value)} r="4.5" fill="var(--gold)" />
          </g>
        )}
      </svg>
      <div className="admin-chart-readout" dir="rtl">
        {active ? `${active.date}: ${active.value.toLocaleString('en-US')}` : `סה״כ בתקופה: ${points.reduce((sum, point) => sum + point.value, 0).toLocaleString('en-US')}`}
      </div>
    </div>
  );
}

function Bars({ chart }: { chart: AdminBreakdown }) {
  if (!chart.available) return <EmptyChart reason={chart.reason} />;
  const items = chart.items.slice(0, 10);
  const max = Math.max(1, ...items.map(item => item.value));
  if (items.length === 0) return <EmptyChart reason="אין נתונים עדיין." />;
  return (
    <ul className="admin-bars">
      {items.map(item => (
        <li key={item.name}>
          <span className="admin-bar-label">{item.name}</span>
          <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></span>
          <span className="admin-bar-value">{item.value.toLocaleString('en-US')}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart({ reason }: { reason: string }) {
  return <div className="admin-chart-empty">לא נמדד עדיין<small>{reason}</small></div>;
}

export function AdminCharts({ charts }: { charts: AdminOverviewCharts }) {
  return (
    <div className="admin-chart-grid">
      {SERIES_CHARTS.map(({ key, label }) => (
        <div className="admin-chart glass" key={key}>
          <h3>{label}</h3>
          <LineChart chart={charts[key] as AdminChart} />
        </div>
      ))}
      {BREAKDOWN_CHARTS.map(({ key, label }) => (
        <div className="admin-chart glass" key={key}>
          <h3>{label}</h3>
          <Bars chart={charts[key] as AdminBreakdown} />
        </div>
      ))}
    </div>
  );
}
