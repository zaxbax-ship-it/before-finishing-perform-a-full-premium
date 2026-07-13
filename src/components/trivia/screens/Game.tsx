'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AudienceIcon, CloseIcon, ConfirmIcon, FiftyFiftyIcon, PhoneFriendIcon, PremiumIcon, SwapQuestionIcon, WalletIcon } from '@/lib/design/icons';
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

// Stage 22 — 'milestone-exit' is the calm out-phase of the milestone transition:
// the ladder is still visible (so the whole transition lasts >=2.5s) while it
// gently sinks away before the next question resumes.
export type GamePhase = 'intro' | 'question' | 'feedback' | 'milestone' | 'milestone-exit';

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
  // The ladder overlay owns the whole intro + milestone transition (enter/hold/exit).
  const showLadder = gamePhase === 'intro' || gamePhase === 'milestone' || gamePhase === 'milestone-exit';
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
  // Stage 22 — as each question becomes active, focus moves to the QUESTION
  // HEADING (a neutral element with no focus-ring), never to an answer. This
  // announces the question to screen readers and guarantees no answer wears the
  // gold focus ring before the player interacts. Genuine keyboard Tab still
  // rings the focused answer exactly as expected.
  const questionRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (gamePhase === 'question') questionRef.current?.focus();
  }, [gamePhase, current.id]);
  // Stage 22 — the ladder overlay is PORTALLED to <body> so its fixed, viewport-
  // centred position is never trapped by an ancestor transform (the keyed
  // .screen-section entrance animation establishes a containing block).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const answerInfo = selected !== null ? {
    correct: selected === current.correctIndex,
    answer: current.correctAnswer || current.answers[current.correctIndex]
  } : null;
  // Correct/Wrong feedback sheet: a presentation of the EXISTING feedback state
  // (selected + verdict) during the feedback phase. It auto-dismisses when the
  // phase advances — the auto-advance timing/scoring is untouched. The button is
  // a local "read it, hide now" and never drives the game state machine.
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  useEffect(() => { setFeedbackDismissed(false); }, [current.id, round]);
  const showFeedbackSheet = mounted && gamePhase === 'feedback' && answerInfo !== null && !feedbackDismissed;
  const answersLocked = selected !== null || gamePhase !== 'question';
  return (
    <section className="compact-game-shell game-priority-layout mx-auto w-full max-w-3xl px-4 pb-10">
      {/* Stage 22 — during the ladder, the card clears to the Home stage so the
          milestone view sits on the identical navy + azure + gold background. */}
      <section className={`glass question-priority rounded-[32px] p-5 md:p-8 ${showLadder ? 'stage-clear' : ''}`}>
        {/* Stage 22 — the gameplay header is the shared site logo (no question
            counter, no separate Home button). The logo is the Home control and
            routes through the protected exit/cash-out flow. */}
        <div className={`game-topline game-topline-slim ${showLadder ? 'stage-hidden' : ''}`}>
          <button type="button" className="app-brand focus-ring" onClick={requestExit} aria-label={t.exitHomeAria} title={t.exitHomeAria}>
            <span className="app-brand-mark"><PremiumIcon size={22} aria-hidden="true" /></span>
            <span className="app-brand-text"><strong>{t.headline}</strong></span>
          </button>
        </div>
        <span className="sr-only" role="timer" aria-live="off">{fmt(t.timerRemaining, { seconds: timerModel.remaining })}</span>
        <h2 ref={questionRef} tabIndex={-1} key={`q-${current.id}`} className={`question-text stage-enter mb-6 max-w-5xl text-3xl font-black leading-[1.22] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.12)] md:text-5xl ${showLadder ? 'stage-hidden' : ''}`}>{current.question}</h2>

        <div className="game-stage-wrap">
          {mounted && showLadder && createPortal(
            <div className={`milestone-focus milestone-focus-${gamePhase}`}>
              <MilestoneLadder t={t} correct={ladderCorrect} />
            </div>,
            document.body
          )}
          {showFeedbackSheet && answerInfo && createPortal(
            <div className="answer-modal" role="status" aria-live="polite">
              <div className={`answer-sheet ${answerInfo.correct ? 'is-correct' : 'is-wrong'}`}>
                <span className={`answer-sheet-icon ${answerInfo.correct ? 'is-correct' : 'is-wrong'}`} aria-hidden="true">
                  {answerInfo.correct ? <ConfirmIcon size={34} /> : <CloseIcon size={34} />}
                </span>
                <h3 className={`answer-sheet-title ${answerInfo.correct ? 'is-correct' : 'is-wrong'}`}>{answerInfo.correct ? infoUi.correct : infoUi.wrong}</h3>
                <p className="answer-sheet-text">{answerInfo.correct ? money(currentPrize) : `${infoUi.answer}: ${answerInfo.answer}`}</p>
                <button type="button" className="answer-sheet-go focus-ring" onClick={() => setFeedbackDismissed(true)}>{infoUi.action}</button>
              </div>
            </div>,
            document.body
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

        {/* Stage 22 — bottom status: a centred stack of the remaining chances with
            the larger current winnings directly below them. */}
        <div className={`game-bottom-status ${showLadder ? 'stage-hidden' : ''}`}>
          <ChanceMeter total={SOLO_INITIAL_LIVES} remaining={chances} label={fmt(t.chancesStatus, { count: chances, total: SOLO_INITIAL_LIVES })} />
          <span className="game-bottom-pot" aria-label={`${t.currentPot}: ${money(currentPrize)}`}>{money(animatedPot)}</span>
        </div>
      </section>
    </section>
  );
}
