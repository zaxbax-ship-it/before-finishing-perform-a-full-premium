'use client';

import { useState } from 'react';
import { DeleteIcon, SettingsIcon } from '@/lib/design/icons';
import { Field, Panel } from '../primitives';
import type { Settings } from '../types';

export function SettingsPanel({ t, settings, setSettings, reset }: { t: Record<string, string>; settings: Settings; setSettings: (settings: Settings | ((settings: Settings) => Settings)) => void; reset: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const timerOptions = [
    { value: 'רגועה', label: t.timerCalm },
    { value: 'דרמטית', label: t.timerDramatic },
    { value: 'אינטנסיבית', label: t.timerIntense }
  ];
  return (
    <Panel title={t.settings} icon={<SettingsIcon size={26} aria-hidden="true" />}>
      <div className="grid gap-2 max-w-2xl mx-auto">
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
