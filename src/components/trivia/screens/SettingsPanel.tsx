'use client';

import { useEffect, useState } from 'react';
import { ConfirmIcon, DeleteIcon, SettingsIcon } from '@/lib/design/icons';
import { validateNickname } from '../format';
import { Field, Panel } from '../primitives';
import type { LeaderboardStatus, Settings } from '../types';

export function SettingsPanel({ t, settings, setSettings, reset, nickname, saveNickname, leaderboardStatus, authUi }: {
  t: Record<string, string>;
  settings: Settings;
  setSettings: (settings: Settings | ((settings: Settings) => Settings)) => void;
  reset: () => void;
  nickname: string;
  saveNickname: (value: string) => void | Promise<void>;
  leaderboardStatus: LeaderboardStatus;
  authUi: Record<string, string>;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  // Stage 17 — nickname editing lives here (the single public management home),
  // relocated out of the Leaderboard. Available to every player (guest included).
  const [draft, setDraft] = useState(nickname);
  useEffect(() => { setDraft(nickname); }, [nickname]);
  const validation = validateNickname(draft, authUi);
  const nicknameMessage = leaderboardStatus === 'saving'
    ? t.lbLoading
    : leaderboardStatus === 'saved'
      ? t.lbSaved
      : leaderboardStatus === 'taken'
        ? t.lbTaken
        : leaderboardStatus === 'error'
          ? t.lbError
          : '';

  const timerOptions = [
    { value: 'רגועה', label: t.timerCalm },
    { value: 'דרמטית', label: t.timerDramatic },
    { value: 'אינטנסיבית', label: t.timerIntense }
  ];
  return (
    <Panel title={t.settings} icon={<SettingsIcon size={26} aria-hidden="true" />}>
      <div className="grid gap-2 max-w-2xl mx-auto">
        <div className="setting-nickname">
          <Field label={t.lbNickname}>
            <input
              className="form-input"
              value={draft}
              maxLength={20}
              onChange={event => setDraft(event.target.value)}
              aria-invalid={draft.length > 0 && !validation.ok}
            />
          </Field>
          <p className={`nickname-live-message ${draft.trim() ? (validation.ok ? 'valid' : 'invalid') : 'prompt'}`} aria-live="polite">
            {draft.trim() && validation.ok && <ConfirmIcon size={14} aria-hidden="true" />}
            <span>{draft.trim() ? validation.message : authUi.nicknamePrompt}</span>
          </p>
          <button
            className="premium-button focus-ring inline-flex w-full items-center justify-center gap-2"
            disabled={leaderboardStatus === 'saving' || !validation.ok}
            onClick={() => void saveNickname(draft)}
          >
            {t.lbSave}
          </button>
          {nicknameMessage && <div className={`leaderboard-message ${leaderboardStatus}`} aria-live="polite">{nicknameMessage}</div>}
        </div>

        <label className="setting-row">
          <span className="font-bold">{t.soundLbl}</span>
          <input type="checkbox" checked={settings.sound} onChange={event => setSettings(value => ({ ...value, sound: event.target.checked }))} className="h-5 w-5 rounded accent-gold" />
        </label>
        <label className="setting-row">
          <span className="font-bold">{t.effectsLbl}</span>
          <input type="checkbox" checked={settings.effects} onChange={event => setSettings(value => ({ ...value, effects: event.target.checked }))} className="h-5 w-5 rounded accent-gold" />
        </label>

        <div className="mt-3">
          <Field label={t.timerLbl}>
            <select className="form-input !py-3 !px-4" value={settings.timer} onChange={event => setSettings(value => ({ ...value, timer: event.target.value }))}>
              {timerOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
        </div>

        {!confirmReset ? (
          <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2 mt-5" onClick={() => setConfirmReset(true)}>
            <DeleteIcon size={16} aria-hidden="true" />
            {t.resetData}
          </button>
        ) : (
          <div className="setting-reset-confirm mt-5" role="group" aria-label={t.resetData}>
            <p>{t.resetConfirm}</p>
            <div className="setting-reset-actions">
              <button className="ghost-button focus-ring" onClick={reset}>{t.resetConfirmYes}</button>
              <button className="premium-button focus-ring" onClick={() => setConfirmReset(false)} data-autofocus>{t.resetConfirmNo}</button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
