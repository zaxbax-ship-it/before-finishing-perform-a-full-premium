import { ProfileIcon } from '@/lib/design/icons';
import { money } from '../format';
import { ACHIEVEMENT_KEYS } from '../i18n';
import { Metric, Panel } from '../primitives';
import type { Stats } from '../types';

export function Profile({ t, stats }: { t: Record<string, string>; stats: Stats }) {
  return <Panel title={t.profile} icon={<ProfileIcon size={26} aria-hidden="true" />}><div className="grid gap-4 md:grid-cols-3"><Metric value={String(stats.games)} label={t.gamesPlayed} /><Metric value={money(stats.bestPrize)} label={t.bestWin} gold /><Metric value={String(stats.correct)} label={t.correctTotal} /><Metric value={money(stats.totalMoney)} label={t.moneyTotal} gold /><Metric value={String(stats.lifelines)} label={t.lifelinesUsed} /><Metric value={String(stats.achievements.length)} label={t.achievementsLbl} /></div><div className="mt-6 rounded-3xl border border-white/12 bg-white/[0.07] p-5"><h3 className="mb-3 text-xl font-black">{t.achievementsLbl}</h3><div className="flex flex-wrap gap-3">{stats.achievements.map(item => <span key={item} className="rounded-full bg-gold/15 px-4 py-2 text-sm font-bold text-gold">{ACHIEVEMENT_KEYS[item] ? t[ACHIEVEMENT_KEYS[item]] : item}</span>)}</div></div></Panel>;
}
