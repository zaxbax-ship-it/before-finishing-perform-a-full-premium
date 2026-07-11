'use client';

import { useEffect, useRef } from 'react';
import { GameplayAdSlot } from '@/components/ads/AdSlot';
import { AudienceIcon, ConfirmIcon, FiftyFiftyIcon, ForwardIcon, HomeIcon, LeaderboardIcon, PhoneFriendIcon, PremiumIcon, SwapQuestionIcon, WalletIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { lifelineAvailability, lifelinePrice, SOLO_INITIAL_LIVES } from '@/lib/gameplay/economy';
import { timerProgress } from '@/lib/gameplay/timer';
import { ChanceMeter } from '../ChanceMeter';
import { LETTERS, MONEY, OPTION_LETTERS, SAFE_STEPS, SOLO_TIMER_SECONDS } from '../constants';
import { fmt, money } from '../format';
import { useCountUp } from '../useCountUp';
import { getInfoUi } from '../i18n';
import type { GameQuestion, Lifeline } from '../types';

export function Game(props: {
  t: Record<string, string>;
  locale: Locale;
  current: GameQuestion;
  round: number;
  order: number[];
  selected: number | null;
  hiddenAnswers: number[];
  timer: number;
  progress: number;
  currentPrize: number;
  guaranteedPrize: number;
  chances: number;
  lifelineUses: Record<Lifeline, number>;
  lifelineUsedThisQuestion: Lifeline | null;
  advice: string;
  notice: string;
  chooseAnswer: (index: number) => void;
  advanceAfterAnswer: () => void;
  triggerLifeline: (type: Lifeline) => void;
  quit: () => void;
  requestExit: () => void;
}) {
  const { t, locale, current, round, order, selected, hiddenAnswers, timer, currentPrize, guaranteedPrize, chances, lifelineUses, lifelineUsedThisQuestion, advice, notice, chooseAnswer, advanceAfterAnswer, triggerLifeline, quit, requestExit } = props;
  // Presentation-only: the pot eases between real values; logic sees exact numbers.
  const animatedPot = useCountUp(currentPrize, 650);
  const optionLetters = OPTION_LETTERS[locale] || LETTERS;
  const timerModel = timerProgress(SOLO_TIMER_SECONDS, timer);
  // Stage 20 — the single countdown bar shifts azure -> gold -> red across the
  // 25s, then a stronger, slightly thicker red for the final urgent seconds.
  const elapsed = SOLO_TIMER_SECONDS - timer;
  const timerBand = timer <= 4 ? 'critical' : elapsed < 7 ? 'azure' : elapsed < 14 ? 'gold' : 'red';
  const infoUi = getInfoUi(locale);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selected !== null) nextButtonRef.current?.focus();
  }, [selected]);
  const answerInfo = selected !== null ? {
    correct: selected === current.correctIndex,
    answer: current.correctAnswer || current.answers[current.correctIndex],
    explanation: current.explanation || ''
  } : null;
  return (
    <section className="compact-game-shell game-priority-layout mx-auto grid w-full max-w-[1720px] gap-6 px-4 pb-10 lg:grid-cols-[1fr_380px] lg:px-8">
      <section className="glass question-priority rounded-[32px] p-5 md:p-8">
        <div className="game-topline">
          <button type="button" className="game-topline-home focus-ring" aria-label={t.exitHomeAria} title={t.exitHomeAria} onClick={requestExit}><HomeIcon size={18} aria-hidden="true" /></button>
          <span className="game-topline-info">{round + 1}/15 · {current.category}</span>
          <span className="game-topline-chances">
            <ChanceMeter total={SOLO_INITIAL_LIVES} remaining={chances} label={fmt(t.chancesStatus, { count: chances, total: SOLO_INITIAL_LIVES })} />
          </span>
          <span className="sr-only" role="timer" aria-live="off">{fmt(t.timerRemaining, { seconds: timerModel.remaining })}</span>
          <span className="game-topline-pot" title={money(currentPrize)} aria-label={`${t.currentPot}: ${money(currentPrize)}`}>{money(animatedPot)}</span>
        </div>
        {current.imageUrl && (
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-white/[0.04] w-full" style={{ aspectRatio: '16/9', maxHeight: '18rem' }}>
            <img src={current.imageUrl} alt={infoUi.imageAlt} className="h-full w-full object-cover" />
          </div>
        )}
        <h2 key={`q-${current.id}`} className="question-text stage-enter mb-6 max-w-5xl text-3xl font-black leading-[1.22] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.12)] md:text-5xl">{current.question}</h2>

        {/* Stage 19/20 — ONE unified gameplay stage: answers, lifelines and the
            single countdown bar share one premium surface. */}
        <div className="gameplay-stage">
          <div key={`a-${current.id}`} className="answers-grid grid gap-4">
            {order.map((answerIndex, displayIndex) => {
              const state = selected === null ? '' : answerIndex === current.correctIndex ? 'correct' : selected === answerIndex ? 'wrong' : '';
              return (
                <button key={answerIndex} disabled={selected !== null || hiddenAnswers.includes(answerIndex)} onClick={() => chooseAnswer(answerIndex)} className={['answer-button focus-ring', state, hiddenAnswers.includes(answerIndex) ? 'eliminated' : ''].join(' ')} style={{ ['--enter-delay' as string]: `${displayIndex * 70}ms` }}>
                  <span className="answer-letter inline-grid h-9 w-9 place-items-center rounded-full font-black">{optionLetters[displayIndex]}</span>
                  <span className="text-xl font-bold">{current.answers[answerIndex]}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 20 — lifelines are four clean controls only: no title, no info. */}
          <div className="stage-lifelines">
            <div className="grid grid-cols-4 gap-3">{(['fifty', 'swap', 'phone', 'audience'] as Lifeline[]).map(type => {
              const LifelineIcon = type === 'fifty' ? FiftyFiftyIcon : type === 'swap' ? SwapQuestionIcon : type === 'phone' ? PhoneFriendIcon : AudienceIcon;
              const price = lifelinePrice(currentPrize, lifelineUses[type]);
              const availability = lifelineAvailability(lifelineUses[type], lifelineUsedThisQuestion !== null, currentPrize);
              const disabled = availability !== 'free' && availability !== 'paid';
              const usedHere = availability === 'locked-question' && lifelineUsedThisQuestion === type;
              const statusLabel =
                availability === 'exhausted' ? t.lifelineExhausted
                : availability === 'insufficient-pot' ? t.lifelineNeedsPot
                : availability === 'locked-question' ? (usedHere ? t.lifelineUsedThisQuestion : t.lifelineLockedThisQuestion)
                : availability === 'paid' ? money(price as number)
                : t.free;
              const stateClass =
                availability === 'exhausted' ? 'exhausted'
                : availability === 'insufficient-pot' ? 'needs-pot'
                : availability === 'locked-question' ? 'locked'
                : availability === 'paid' ? 'paid' : '';
              return (
                <button
                  key={type}
                  className={`lifeline-tile focus-ring ${stateClass}`}
                  onClick={() => triggerLifeline(type)}
                  disabled={disabled}
                  aria-disabled={disabled}
                  aria-label={`${t[type]} — ${statusLabel}`}
                  title={disabled ? statusLabel : t[type]}
                >
                  <span className="lifeline-icon-shell"><LifelineIcon size={20} aria-hidden="true" /></span>
                  <span className="sr-only">{t[type]}</span>
                  <small className="lifeline-status" aria-hidden="true">
                    {availability === 'paid'
                      ? money(price as number)
                      : availability === 'insufficient-pot'
                        ? <WalletIcon size={12} />
                        : usedHere
                          ? <ConfirmIcon size={12} />
                          : ''}
                  </small>
                </button>
              );
            })}</div>
          </div>

          <div className="gameplay-timer" aria-hidden="true">
            <span key={`timer-${current.id}`} className={`gameplay-timer-fill band-${timerBand}`} style={{ width: `${timerModel.progress * 100}%` }} />
          </div>
        </div>

        {answerInfo && (
          <div className="game-next-row">
            <button
              ref={nextButtonRef}
              type="button"
              className="game-next-button focus-ring ready"
              onClick={advanceAfterAnswer}
            >
              <span className="game-next-label">
                {infoUi.action}
                <ForwardIcon size={18} aria-hidden="true" />
              </span>
            </button>
          </div>
        )}
        <span className="sr-only" role="status" aria-live="assertive">
          {answerInfo ? `${answerInfo.correct ? infoUi.correct : infoUi.wrong}. ${infoUi.answer}: ${answerInfo.answer}` : ''}
        </span>
        {advice && <div className="mt-6 rounded-3xl border border-azure/35 bg-azure/10 p-5 text-lg leading-8 text-white/82">{advice}</div>}
        {notice && <div className="mt-6 rounded-3xl border border-gold/40 bg-gold/10 p-5 text-lg leading-8 text-gold">{notice}</div>}
      </section>
      <aside className="space-y-5">
        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 text-xl font-extrabold">{t.ladder}</h3>
          <div className="prize-ladder">{MONEY.map((amount, index) => {
            const isTop = index === MONEY.length - 1;
            const isSafe = SAFE_STEPS.includes(index);
            const state = index === round ? 'current' : index < round ? 'passed' : '';
            return (
              <div key={`${amount}-${index}`} className={['ladder-item', state, isSafe ? 'safe' : '', isTop ? 'top' : ''].join(' ')}>
                <span className="ladder-step">{index + 1}</span>
                <strong className="ladder-amount">{money(amount)}</strong>
                <span className="ladder-badge" aria-hidden="true">
                  {isTop ? <PremiumIcon size={15} /> : isSafe ? <LeaderboardIcon size={14} /> : state === 'passed' ? <ConfirmIcon size={13} /> : null}
                </span>
              </div>
            );
          }).reverse()}</div>
        </div>
        <div className="glass rounded-[28px] p-5">
          <div className="text-sm text-white/55">{t.guaranteed}</div>
          <div className="text-2xl font-black text-gold">{money(guaranteedPrize)}</div>
          <button className="ghost-button focus-ring mt-4 w-full" onClick={quit}>{t.quit}</button>
        </div>
        <GameplayAdSlot placement="gameplay-sidebar" className="hidden xl:grid" />
      </aside>
    </section>
  );
}
