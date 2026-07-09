'use client';

import { useEffect, useRef } from 'react';
import { GameplayAdSlot } from '@/components/ads/AdSlot';
import { AudienceIcon, ConfirmIcon, FiftyFiftyIcon, ForwardIcon, HintsIcon, HomeIcon, LeaderboardIcon, PhoneFriendIcon, PremiumIcon, SwapQuestionIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { lifelinePrice, SOLO_INITIAL_LIVES } from '@/lib/gameplay/economy';
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
  timerUrgency: string;
  progress: number;
  currentPrize: number;
  nextPrize: number;
  guaranteedPrize: number;
  chances: number;
  lifelineUses: Record<Lifeline, number>;
  advice: string;
  notice: string;
  chooseAnswer: (index: number) => void;
  advanceAfterAnswer: () => void;
  triggerLifeline: (type: Lifeline) => void;
  quit: () => void;
  requestExit: () => void;
}) {
  const { t, locale, current, round, order, selected, hiddenAnswers, timer, timerUrgency, progress, currentPrize, nextPrize, guaranteedPrize, chances, lifelineUses, advice, notice, chooseAnswer, advanceAfterAnswer, triggerLifeline, quit, requestExit } = props;
  // Presentation-only: the pot eases between real values; logic sees exact numbers.
  const animatedPot = useCountUp(currentPrize, 650);
  const optionLetters = OPTION_LETTERS[locale] || LETTERS;
  // Countdown ring: purely presentational — same clock, same 45s duration.
  const RING_CIRCUMFERENCE = 2 * Math.PI * 23;
  const timerRatio = Math.max(0, Math.min(1, timer / SOLO_TIMER_SECONDS));
  const infoUi = getInfoUi(locale);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  // Keyboard flow: focus moves to the continue button once an answer locks in.
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
          <span className="game-topline-info">{t.question} {round + 1}/15 · {current.category}</span>
          <span className="game-topline-chances">
            <ChanceMeter total={SOLO_INITIAL_LIVES} remaining={chances} label={fmt(t.chancesStatus, { count: chances, total: SOLO_INITIAL_LIVES })} />
          </span>
          <span className={`game-timer-ring ${timerUrgency}`} role="timer">
            <svg viewBox="0 0 52 52" aria-hidden="true">
              <circle className="ring-track" cx="26" cy="26" r="23" />
              <circle
                className="ring-progress"
                cx="26"
                cy="26"
                r="23"
                transform="rotate(-90 26 26)"
                style={{ strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: RING_CIRCUMFERENCE * (1 - timerRatio) }}
              />
            </svg>
            <strong>{timer}</strong>
          </span>
          <span className="game-topline-pot" title={money(currentPrize)} aria-label={`${t.currentPot}: ${money(currentPrize)}`}>{money(animatedPot)}</span>
        </div>
        {current.imageUrl && (
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-white/[0.04] w-full" style={{ aspectRatio: '16/9', maxHeight: '18rem' }}>
            <img src={current.imageUrl} alt={infoUi.imageAlt} className="h-full w-full object-cover" />
          </div>
        )}
        <h2 key={`q-${current.id}`} className="question-text stage-enter mb-6 max-w-5xl text-3xl font-black leading-[1.22] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.12)] md:text-5xl">{current.question}</h2>
        <div key={`a-${current.id}`} className="answers-grid grid gap-4 md:grid-cols-2">
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
        {/* Player-paced continue: always present, disabled until an answer is
            locked in, then armed with the activation pulse. No auto-advance —
            the player controls the pace. */}
        <div className="game-next-row">
          <button
            ref={nextButtonRef}
            type="button"
            className={`game-next-button focus-ring ${answerInfo ? 'ready' : ''}`}
            disabled={!answerInfo}
            onClick={advanceAfterAnswer}
          >
            {infoUi.action}
            <ForwardIcon size={18} aria-hidden="true" />
          </button>
        </div>
        <span className="sr-only" role="status" aria-live="assertive">
          {answerInfo ? `${answerInfo.correct ? infoUi.correct : infoUi.wrong}. ${infoUi.answer}: ${answerInfo.answer}` : ''}
        </span>
        {advice && <div className="mt-6 rounded-3xl border border-azure/35 bg-azure/10 p-5 text-lg leading-8 text-white/82">{advice}</div>}
        {notice && <div className="mt-6 rounded-3xl border border-gold/40 bg-gold/10 p-5 text-lg leading-8 text-gold">{notice}</div>}
        {/* Slim meta strip: only information not already shown in the topline. */}
        <div className="game-meta-below mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-bold text-gold">{t.currentPrize}: {money(nextPrize)}</span>
          <span className="text-white/55">{t.guaranteed}: {money(guaranteedPrize)}</span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-gold to-azure transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      </section>
      <aside className="space-y-5">
        <div className="glass rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-extrabold">{t.lifelines}</h3><span className="text-gold"><HintsIcon size={16} aria-hidden="true" /></span></div>
          <div className="grid grid-cols-4 gap-3">{(['fifty', 'swap', 'phone', 'audience'] as Lifeline[]).map(type => {
            const LifelineIcon = type === 'fifty' ? FiftyFiftyIcon : type === 'swap' ? SwapQuestionIcon : type === 'phone' ? PhoneFriendIcon : AudienceIcon;
            const price = lifelinePrice(currentPrize, lifelineUses[type]);
            const exhausted = price === null;
            // A second use always shows its price (even $0 at an empty pot) so
            // the tile never looks "free" when a confirm dialog will appear.
            const stateLabel = exhausted ? t.usedUp : lifelineUses[type] >= 1 ? money(price as number) : t.free;
            return (
              <button
                key={type}
                className={`lifeline-tile focus-ring ${exhausted ? 'exhausted' : lifelineUses[type] ? 'paid' : ''}`}
                onClick={() => triggerLifeline(type)}
                disabled={exhausted}
                aria-disabled={exhausted}
                aria-label={exhausted ? `${t[type]} — ${t.lifelineExhausted}` : `${t[type]} — ${stateLabel}`}
                title={exhausted ? t.lifelineExhausted : t[type]}
              >
                <span className="lifeline-icon-shell"><LifelineIcon size={20} aria-hidden="true" /></span>
                <span className="sr-only">{t[type]}</span>
                <small>{stateLabel}</small>
              </button>
            );
          })}</div>
          <p className="mt-4 text-sm leading-6 text-white/55">{t.reuseHint}</p>
        </div>
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
