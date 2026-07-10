'use client';

import { useEffect, useState } from 'react';
import { ConfirmIcon, LeaderboardIcon } from '@/lib/design/icons';
import type { LeaderboardEntry } from '@/lib/domain/models';
import type { Locale } from '@/lib/types';
import { money, validateNickname } from '../format';
import { Field, Panel } from '../primitives';
import type { LeaderboardStatus } from '../types';

export function Leaderboard({ t, entries, status, nickname, authUi, setNickname, bestPrize }: {
  t: Record<string, string>;
  entries: LeaderboardEntry[];
  status: LeaderboardStatus;
  nickname: string;
  locale: Locale;
  authUi: Record<string, string>;
  setNickname: (value: string) => void | Promise<void>;
  bestPrize: number;
}) {
  const [draft, setDraft] = useState(nickname);

  useEffect(() => {
    setDraft(nickname);
  }, [nickname]);

  const validation = validateNickname(draft, authUi);
  const message = status === 'loading' || status === 'saving'
    ? t.lbLoading
    : status === 'saved'
      ? t.lbSaved
      : status === 'taken'
        ? t.lbTaken
        : status === 'error'
          ? t.lbError
          : '';

  return (
    <Panel title={t.lbTitle} icon={<LeaderboardIcon size={26} aria-hidden="true" />}>
      <div className="leaderboard-layout">
        <section className="leaderboard-profile-card">
          <div className="leaderboard-personal-best">
            <span>{t.lbYourBest}</span>
            <strong>{money(bestPrize)}</strong>
          </div>
          <Field label={t.lbNickname}>
            <input
              className="form-input"
              value={draft}
              maxLength={20}
              onChange={event => setDraft(event.target.value)}
              placeholder={t.lbNickname}
              aria-invalid={draft.length > 0 && !validation.ok}
            />
          </Field>
          <p className={`nickname-live-message ${draft.trim() ? (validation.ok ? 'valid' : 'invalid') : 'prompt'}`} aria-live="polite">
            {draft.trim() && validation.ok && <ConfirmIcon size={14} aria-hidden="true" />}
            <span>{draft.trim() ? validation.message : authUi.nicknamePrompt}</span>
          </p>
          {!draft.trim() && <p className="leaderboard-hint">{t.lbNicknameHint}</p>}
          <button
            className="premium-button focus-ring inline-flex w-full items-center justify-center gap-2"
            disabled={status === 'saving' || !validation.ok}
            onClick={() => void setNickname(draft)}
          >
            <ConfirmIcon size={16} />
            {t.lbSave}
          </button>
          {message && <div className={`leaderboard-message ${status}`} aria-live="polite">{message}</div>}
        </section>

        <section className="leaderboard-table-card">
          {entries.length === 0 && status !== 'loading' && <p className="leaderboard-empty">{t.lbEmpty}</p>}
          {status === 'loading' && entries.length === 0 && (
            <div className="leaderboard-list" aria-busy="true" aria-label="Loading leaderboard">
              <div className="leaderboard-row leaderboard-head">
                <span>{t.lbRank}</span>
                <span>{t.lbPlayer}</span>
                <span>{t.lbBest}</span>
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
      </div>
    </Panel>
  );
}
