import { AchievementsIcon } from '@/lib/design/icons';
import { fmt, money } from '../format';
import { Metric } from '../primitives';
import type { EndState } from '../types';

export function Result({ t, authUi, isAuthenticated, state, correctCount, elapsed, prize, start, home }: { t: Record<string, string>; authUi: Record<string, string>; isAuthenticated: boolean; state: EndState; correctCount: number; elapsed: number; prize: number; start: () => void; home: () => void }) {
  const title = state === 'win' ? t.winTitle : state === 'quit' ? t.quitTitle : state === 'timeout' ? t.timeoutTitle : t.lostTitle;
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <section className="mx-auto grid min-h-[calc(100vh-104px)] max-w-5xl place-items-center px-6 pb-14">
      <div className="glass w-full rounded-[34px] p-8 text-center md:p-12">
        <div className="mx-auto mb-5 text-7xl text-gold"><AchievementsIcon size={56} aria-hidden="true" /></div>
        <h2 className="text-5xl font-black">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-xl leading-8 text-white/70">{fmt(t.resultSummary, { correct: correctCount, time, prize: money(prize) })}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3"><Metric value={`${correctCount}/15`} label={t.accuracy} /><Metric value={`${elapsed}s`} label={t.timeLabel} /><Metric value={money(prize)} label={t.homePrize} gold /></div>
        {!isAuthenticated && (
          <div className="guest-progress-cta" role="note">
            <strong>{authUi.guestCtaTitle}</strong>
            <p>{authUi.guestCtaBody}</p>
            <div>
              <a className="ghost-button focus-ring" href="/login">{authUi.signIn}</a>
              <a className="premium-button focus-ring" href="/signup">{authUi.createAccount}</a>
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"><button className="premium-button focus-ring" onClick={start}>{t.playAgain}</button><button className="ghost-button focus-ring" onClick={() => navigator.share?.({ title: t.headline, text: fmt(t.shareText, { prize: money(prize) }) })}>{t.shareBtn}</button><button className="ghost-button focus-ring" onClick={home}>{t.home}</button></div>
      </div>
    </section>
  );
}
