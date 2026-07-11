'use client';

import { useEffect, useRef } from 'react';
import { AudienceIcon, ConfirmIcon, FiftyFiftyIcon, HomeIcon, PhoneFriendIcon, SwapQuestionIcon, WalletIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { lifelineAvailability, lifelinePrice, SOLO_INITIAL_LIVES } from '@/lib/gameplay/economy';
import { timerProgress } from '@/lib/gameplay/timer';
import { ChanceMeter } from '../ChanceMeter';
import { LETTERS, OPTION_LETTERS, SOLO_TIMER_SECONDS } from '../constants';
import { fmt, money } from '../format';
import { useCountUp } from '../useCountUp';
import { getInfoUi } from '../i18n';
import { MilestoneLadder } from './MilestoneLadder';
import type { GameQuestion, Lifeline } from '../types';

export type GamePhase = 'intro' | 'question' | 'feedback' | 'milestone';

export function Game(props: {
  t: Record<string, string>;
  locale: Locale;
  current: GameQuestion;
  round: number;
  order: number[];
  selected: number | null;
  hiddenAnswers: number[];
  timer: number;
  currentPrize: number;
  chances: number;
  lifelineUses: Record<Lifeline, number>;
  lifelineUsedThisQuestion: Lifeline | null;
  advice: string;
  notice: string;
  gamePhase: GamePhase;
  ladderCorrect: number;
  chooseAnswer: (index: number) => void;
  triggerLifeline: (type: Lifeline) => void;
  requestExit: () => void;
}) {
  const { t, locale, current, round, order, selected, hiddenAnswers, timer, currentPrize, chances, lifelineUses, lifelineUsedThisQuestion, advice, notice, gamePhase, ladderCorrect, chooseAnswer, triggerLifeline, requestExit } = props;
  const showLadder = gamePhase === 'intro' || gamePhase === 'milestone';
  // Presentation-only: the pot eases between real values; logic sees exact numbers.
  const animatedPot = useCountUp(currentPrize, 650);
  const optionLetters = OPTION_LETTERS[locale] || LETTERS;
  const timerModel = timerProgress(SOLO_TIMER_SECONDS, timer);
  // Stage 20C — the timer colour is CONTINUOUSLY derived from elapsed progress
  // (not four class jumps): azure 0-7s, easing to gold by 14s, to red by 21s,
  // and a brighter urgent red for the final ~4s (which also thickens the bar).
  const elapsed = SOLO_TIMER_SECONDS - timer;
  let hue = 203;
  let sat = 90;
  let light = 62;
  if (elapsed >= 7 && elapsed < 14) hue = 203 - (203 - 45) * ((elapsed - 7) / 7);
  else if (elapsed >= 14 && elapsed < 21) hue = 45 - 45 * ((elapsed - 14) / 7);
  else if (elapsed >= 21) { hue = 0; sat = 96; light = 58; }
  const timerColor = `hsl(${Math.round(hue)}, ${sat}%, ${light}%)`;
  const timerCritical = timer <= 4;
  const infoUi = getInfoUi(locale);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Return focus to the gameplay stage as each question becomes active (keyboard
  // clarity replaces the removed Next button; the flow auto-advances).
  useEffect(() => {
    if (gamePhase === 'question') stageRef.current?.focus();
  }, [gamePhase, current.id]);
  const answerInfo = selected !== null ? {
    correct: selected === current.correctIndex,
    answer: current.correctAnswer || current.answers[current.correctIndex]
  } : null;
  const answersLocked = selected !== null || gamePhase !== 'question';
  return (
    <section className="compact-game-shell game-priority-layout mx-auto w-full max-w-3xl px-4 pb-10">
      <section className="glass question-priority rounded-[32px] p-5 md:p-8">
        <div className="game-topline game-topline-slim">
          <button type="button" className="game-topline-home focus-ring" aria-label={t.exitHomeAria} title={t.exitHomeAria} onClick={requestExit}><HomeIcon size={18} aria-hidden="true" /></button>
          <span className="game-topline-info">{round + 1}/15 · {current.category}</span>
        </div>
        <span className="sr-only" role="timer" aria-live="off">{fmt(t.timerRemaining, { seconds: timerModel.remaining })}</span>
        <h2 key={`q-${current.id}`} className="question-text stage-enter mb-6 max-w-5xl text-3xl font-black leading-[1.22] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.12)] md:text-5xl">{current.question}</h2>

        <div className="game-stage-wrap" ref={stageRef} tabIndex={-1}>
          {showLadder && (
            <div className={`milestone-focus milestone-focus-${gamePhase}`}>
              <MilestoneLadder t={t} correct={ladderCorrect} />
            </div>
          )}
          <div className={`gameplay-stage ${showLadder ? 'is-receded' : ''}`} aria-hidden={showLadder ? 'true' : undefined}>
            <div key={`a-${current.id}`} className="answers-grid grid gap-4">
              {order.map((answerIndex, displayIndex) => {
                const state = selected === null ? '' : answerIndex === current.correctIndex ? 'correct' : selected === answerIndex ? 'wrong' : '';
                return (
                  <button key={answerIndex} disabled={answersLocked || hiddenAnswers.includes(answerIndex)} onClick={() => chooseAnswer(answerIndex)} className={['answer-button focus-ring', state, hiddenAnswers.includes(answerIndex) ? 'eliminated' : ''].join(' ')} style={{ ['--enter-delay' as string]: `${displayIndex * 70}ms` }}>
                    <span className="answer-letter inline-grid h-9 w-9 place-items-center rounded-full font-black">{optionLetters[displayIndex]}</span>
                    <span className="text-xl font-bold">{current.answers[answerIndex]}</span>
                  </button>
                );
              })}
            </div>

            <div className="stage-lifelines">
              <div className="grid grid-cols-4 gap-3">{(['fifty', 'swap', 'phone', 'audience'] as Lifeline[]).map(type => {
                const LifelineIcon = type === 'fifty' ? FiftyFiftyIcon : type === 'swap' ? SwapQuestionIcon : type === 'phone' ? PhoneFriendIcon : AudienceIcon;
                const price = lifelinePrice(currentPrize, lifelineUses[type]);
                const availability = lifelineAvailability(lifelineUses[type], lifelineUsedThisQuestion !== null, currentPrize);
                const disabled = (availability !== 'free' && availability !== 'paid') || gamePhase !== 'question';
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

            <div className={`gameplay-timer ${timerCritical ? 'is-critical' : ''}`} aria-hidden="true">
              <span key={`timer-${current.id}`} className="gameplay-timer-fill" style={{ width: `${timerModel.progress * 100}%`, background: timerColor }} />
            </div>
          </div>
        </div>

        <span className="sr-only" role="status" aria-live="assertive">
          {answerInfo ? `${answerInfo.correct ? infoUi.correct : infoUi.wrong}. ${infoUi.answer}: ${answerInfo.answer}` : ''}
        </span>
        {advice && <div className="mt-6 rounded-3xl border border-azure/35 bg-azure/10 p-5 text-lg leading-8 text-white/82">{advice}</div>}
        {notice && <div className="mt-6 rounded-3xl border border-gold/40 bg-gold/10 p-5 text-lg leading-8 text-gold">{notice}</div>}

        {/* Stage 20C — bottom status: only remaining chances + current winnings. */}
        <div className="game-bottom-status">
          <ChanceMeter total={SOLO_INITIAL_LIVES} remaining={chances} label={fmt(t.chancesStatus, { count: chances, total: SOLO_INITIAL_LIVES })} />
          <span className="game-bottom-pot" aria-label={`${t.currentPot}: ${money(currentPrize)}`}>{money(animatedPot)}</span>
        </div>
      </section>
    </section>
  );
}
