'use client';

import { LeaderboardIcon } from '@/lib/design/icons';
import type { LeaderboardEntry } from '@/lib/domain/models';
import { money } from '../format';
import { Panel } from '../primitives';
import type { LeaderboardStatus } from '../types';

/**
 * Stage 17 — the Leaderboard is a PUBLIC rankings screen only. It renders the
 * global ranked players for every visitor (fresh, guest, anonymous-with-local-
 * nickname, authenticated, signed-out) and never contains any personal, account,
 * personal-best or nickname-editing UI. Nickname editing lives in Settings and
 * the account area; personal progress lives in Profile. Because this component
 * only receives public `entries` + a `status`, it is structurally incapable of
 * revealing private data in any auth state.
 */
export function Leaderboard({ t, entries, status }: {
  t: Record<string, string>;
  entries: LeaderboardEntry[];
  status: LeaderboardStatus;
}) {
  const isLoading = status === 'loading' && entries.length === 0;
  const isError = status === 'error' && entries.length === 0;
  const isEmpty = entries.length === 0 && status !== 'loading' && status !== 'error';

  return (
    <Panel title={t.lbTitle} icon={<LeaderboardIcon size={26} aria-hidden="true" />}>
      <section className="leaderboard-table-card">
        {isEmpty && <p className="leaderboard-empty">{t.lbEmpty}</p>}
        {isError && <p className="leaderboard-empty" role="alert">{t.lbError}</p>}
        {isLoading && (
          <div className="leaderboard-list" aria-busy="true" aria-label={t.lbLoading}>
            <div className="leaderboard-row leaderboard-head" role="row">
              <span role="columnheader">{t.lbRank}</span>
              <span role="columnheader">{t.lbPlayer}</span>
              <span role="columnheader">{t.lbBest}</span>
            </div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="leaderboard-row skeleton-row" style={{ opacity: 0.8 }} role="row">
                <span className="leaderboard-rank skeleton-block" role="cell" />
                <span className="skeleton-block" style={{ width: '50%', height: '1.2rem' }} role="cell" />
                <span className="skeleton-block" style={{ width: '30%', height: '1.2rem', justifySelf: 'end' }} role="cell" />
              </div>
            ))}
          </div>
        )}
        {entries.length > 0 && (
          <div className="leaderboard-list" role="table" aria-label={t.lbTitle}>
            <div className="leaderboard-row leaderboard-head" role="row">
              <span role="columnheader">{t.lbRank}</span>
              <span role="columnheader">{t.lbPlayer}</span>
              <span role="columnheader">{t.lbBest}</span>
            </div>
            {entries.map((entry, index) => {
              const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
              return (
                <div key={entry.id} className={`leaderboard-row ${rankClass}`} role="row">
                  <span className="leaderboard-rank font-black" role="cell">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </span>
                  <strong role="cell" className={index < 3 ? 'text-white font-black' : 'text-white/80'}>{entry.nickname || entry.displayName}</strong>
                  <span className="leaderboard-prize" role="cell">{money(entry.bestPrize)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Panel>
  );
}
