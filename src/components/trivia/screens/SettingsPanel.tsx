import { AudienceIcon, CelebrationIcon, DeleteIcon, SettingsIcon } from '@/lib/design/icons';
import { Field, Panel } from '../primitives';
import type { Settings } from '../types';

export function SettingsPanel({ t, settings, setSettings, reset }: { t: Record<string, string>; settings: Settings; setSettings: (settings: Settings | ((settings: Settings) => Settings)) => void; reset: () => void }) {
  const timerOptions = [
    { value: 'רגועה', label: t.timerCalm },
    { value: 'דרמטית', label: t.timerDramatic },
    { value: 'אינטנסיבית', label: t.timerIntense }
  ];
  return (
    <Panel title={t.settings} icon={<SettingsIcon size={26} aria-hidden="true" />}>
      <div className="grid gap-6 max-w-2xl mx-auto">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="setting-row flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer">
            <span className="flex items-center gap-3">
              <span className="text-gold"><AudienceIcon size={20} /></span>
              <span className="font-bold">{t.soundLbl}</span>
            </span>
            <input type="checkbox" checked={settings.sound} onChange={event => setSettings(value => ({ ...value, sound: event.target.checked }))} className="h-5 w-5 rounded accent-gold" />
          </label>
          <label className="setting-row flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer">
            <span className="flex items-center gap-3">
              <span className="text-gold"><CelebrationIcon size={20} /></span>
              <span className="font-bold">{t.effectsLbl}</span>
            </span>
            <input type="checkbox" checked={settings.effects} onChange={event => setSettings(value => ({ ...value, effects: event.target.checked }))} className="h-5 w-5 rounded accent-gold" />
          </label>
        </div>

        <Field label={t.timerLbl}>
          <div className="relative">
            <select className="form-input !py-3 !px-4" value={settings.timer} onChange={event => setSettings(value => ({ ...value, timer: event.target.value }))}>
              {timerOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </Field>

        <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2 mt-4" onClick={reset}>
          <DeleteIcon size={16} />
          {t.resetData}
        </button>
      </div>
    </Panel>
  );
}
