'use client';

import { LeaderboardIcon } from '@/lib/design/icons';
import type { LeaderboardEntry } from '@/lib/domain/models';
import { money } from '../format';
import { Panel } from '../primitives';
import type { LeaderboardStatus } from '../types';

/**
 * Stage 17B — the Leaderboard is public rankings for everyone, plus a READ-ONLY
 * personal-best card shown ONLY when the current session is authenticated.
 *
 * The personal card's visibility is gated solely on `isAuthenticated` (the live
 * session) — never on a local nickname, a cached profile, or a local best. Its
 * value is sourced from the authoritative public list (the signed-in account's
 * own row, matched by its established display name) and falls back to the
 * account best only when the player is not yet ranked. There is no nickname
 * editing, validation, or save control anywhere on this screen.
 */
export function Leaderboard({ t, entries, status, isAuthenticated, personalBest, displayName }: {
  t: Record<string, string>;
  entries: LeaderboardEntry[];
  status: LeaderboardStatus;
  isAuthenticated: boolean;
  personalBest: number;
  displayName: string;
}) {
  const isLoading = status === 'loading' && entries.length === 0;
  const isError = status === 'error' && entries.length === 0;
  const isEmpty = entries.length === 0 && status !== 'loading' && status !== 'error';

  // Authoritative, account-tied best: the signed-in account's own public row.
  const myEntry = isAuthenticated && displayName
    ? entries.find(entry => (entry.nickname || entry.displayName || '') === displayName)
    : undefined;
  const myBest = myEntry ? myEntry.bestPrize : personalBest;
  const myRank = myEntry ? entries.indexOf(myEntry) + 1 : 0;

  return (
    <Panel title={t.lbTitle} icon={<LeaderboardIcon size={26} aria-hidden="true" />}>
      {isAuthenticated && (
        <section className="leaderboard-you" aria-label={t.lbYourBest}>
          <div className="leaderboard-you-head">
            <span className="leaderboard-you-label">{t.lbYourBest}</span>
            {displayName && <span className="leaderboard-you-name">{displayName}</span>}
          </div>
          <strong className="leaderboard-you-score" dir="ltr">{money(myBest)}</strong>
          {myRank > 0 && (
            <span className="leaderboard-you-rank" aria-label={`${t.lbRank}: ${myRank}`}>#{myRank}</span>
          )}
        </section>
      )}

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
                  <span className="leaderboard-rank font-black" role="cell">{index + 1}</span>
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
