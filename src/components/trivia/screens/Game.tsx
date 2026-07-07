import { GameplayAdSlot } from '@/components/ads/AdSlot';
import { AudienceIcon, ConfirmIcon, FavoritesIcon, FiftyFiftyIcon, ForwardIcon, HintsIcon, HomeIcon, PhoneFriendIcon, SwapQuestionIcon, TimerIcon, WarningIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { LETTERS, MONEY, OPTION_LETTERS, priceFor, SAFE_STEPS } from '../constants';
import { money } from '../format';
import { INFO_UI } from '../i18n';
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
  const optionLetters = OPTION_LETTERS[locale] || LETTERS;
  const infoUi = INFO_UI[locale];
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
          <span className="game-topline-chances" aria-label={t.chancesLabel}>{[0, 1, 2].map(index => <span key={index} className={index < chances ? 'text-ember' : 'text-white/22'}><FavoritesIcon size={13} fill="currentColor" aria-hidden="true" /></span>)}</span>
          <span className={`game-topline-timer ${timerUrgency}`}><TimerIcon size={16} aria-hidden="true" /> {timer}</span>
          <span className="game-topline-pot">{money(currentPrize)}</span>
        </div>
        {current.imageUrl && (
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-white/[0.04] w-full" style={{ aspectRatio: '16/9', maxHeight: '18rem' }}>
            <img src={current.imageUrl} alt={infoUi.imageAlt} className="h-full w-full object-cover" />
          </div>
        )}
        <h2 className="question-text mb-6 max-w-5xl text-3xl font-black leading-[1.22] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.12)] md:text-5xl">{current.question}</h2>
        <div className="answers-grid grid gap-4 md:grid-cols-2">
          {order.map((answerIndex, displayIndex) => {
            const state = selected === null ? '' : answerIndex === current.correctIndex ? 'correct' : selected === answerIndex ? 'wrong' : '';
            return (
              <button key={answerIndex} disabled={selected !== null || hiddenAnswers.includes(answerIndex)} onClick={() => chooseAnswer(answerIndex)} className={['answer-button focus-ring', state, hiddenAnswers.includes(answerIndex) ? 'eliminated' : ''].join(' ')}>
                <span className="ml-3 inline-grid h-9 w-9 place-items-center rounded-full bg-white/12 text-gold font-black">{optionLetters[displayIndex]}</span>
                <span className="text-xl font-bold">{current.answers[answerIndex]}</span>
              </button>
            );
          })}
        </div>
        {answerInfo && (
          <div role="status" aria-live="polite" className={answerInfo.correct ? 'answer-info-card correct' : 'answer-info-card wrong'}>
            <div className="answer-info-icon" aria-hidden="true">{answerInfo.correct ? <ConfirmIcon size={20} aria-hidden="true" /> : <WarningIcon size={20} aria-hidden="true" />}</div>
            <div className="answer-info-content">
              <div className="answer-info-header">
                <strong>{answerInfo.correct ? infoUi.correct : infoUi.wrong}</strong>
                <span>{infoUi.answer}: {answerInfo.answer}</span>
              </div>
              <p>{answerInfo.explanation}</p>
              <div className="answer-info-actions">
                <em>{infoUi.next}</em>
                <button className="answer-info-next focus-ring inline-flex items-center gap-2" type="button" autoFocus onClick={advanceAfterAnswer}>{infoUi.action}<ForwardIcon size={16} /></button>
              </div>
            </div>
          </div>
        )}
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
            return <button key={type} className={`lifeline-tile focus-ring ${lifelineUses[type] ? 'paid' : ''}`} onClick={() => triggerLifeline(type)} aria-label={t[type]} title={t[type]}><span className="lifeline-icon-shell"><LifelineIcon size={20} aria-hidden="true" /></span><span className="sr-only">{t[type]}</span><small>{lifelineUses[type] ? money(priceFor(type, currentPrize)) : t.free}</small></button>;
          })}</div>
          <p className="mt-4 text-sm leading-6 text-white/55">{t.reuseHint}</p>
        </div>
        <div className="glass rounded-[28px] p-5">
          <h3 className="mb-4 text-xl font-extrabold">{t.ladder}</h3>
          <div className="space-y-2">{MONEY.map((amount, index) => <div key={`${amount}-${index}`} className={['ladder-item', index === round ? 'current' : '', SAFE_STEPS.includes(index) ? 'safe' : ''].join(' ')}><span>{index + 1}</span><strong>{money(amount)}</strong></div>).reverse()}</div>
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
