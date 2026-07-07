import { PlayIcon, QuestionIcon } from '@/lib/design/icons';
import { Panel } from '../primitives';

export function Rules({ t, start }: { t: Record<string, string>; start: () => void }) {
  const rules = [t.rule1, t.rule2, t.rule3, t.rule4, t.rule5];
  return (
    <Panel title={t.rulesTitle} icon={<QuestionIcon size={26} aria-hidden="true" />}>
      <div className="grid gap-4">{rules.map((rule, index) => <div key={rule} className="rule-row"><span>{index + 1}</span><p>{rule}</p></div>)}</div>
      <button className="premium-button focus-ring mt-9 inline-flex items-center gap-2 text-lg" onClick={start}><PlayIcon size={18} />{t.readyStart}</button>
    </Panel>
  );
}
