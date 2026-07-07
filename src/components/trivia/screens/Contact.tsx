import { ConfirmIcon, MailIcon } from '@/lib/design/icons';
import { Field, Panel } from '../primitives';

export function Contact({ t, sent, setSent }: { t: Record<string, string>; sent: boolean; setSent: (value: boolean) => void }) {
  return (
    <Panel title={t.contact} icon={<MailIcon size={26} aria-hidden="true" />}>
      <div className="grid gap-5 max-w-xl mx-auto">
        <Field label={t.fullName}>
          <input className="form-input" />
        </Field>
        <Field label={t.email}>
          <input className="form-input" type="email" />
        </Field>
        <Field label={t.message}>
          <textarea className="form-input min-h-36" />
        </Field>
        <button className="premium-button focus-ring inline-flex items-center justify-center gap-2 w-full" onClick={() => setSent(true)}>
          <MailIcon size={16} />
          {t.sendMsg}
        </button>
        {sent && (
          <div className="mt-4 p-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 flex items-center gap-3">
            <span className="text-emerald-400"><ConfirmIcon size={20} /></span>
            <span className="font-bold">{t.contactSuccess}</span>
          </div>
        )}
      </div>
    </Panel>
  );
}
