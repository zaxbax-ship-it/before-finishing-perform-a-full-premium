'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdSlot } from '@/components/ads/AdSlot';
import { MultiplayerMode } from '@/components/multiplayer/MultiplayerMode';
import {
  CloseIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  ExportIcon,
  ImportIcon,
  SettingsIcon,
  ConfirmIcon
} from '@/lib/design/icons';
import {
  type AuditLogEntry,
  type CommunitySubmission,
  createAudit,
  submissionToQuestion,
  shouldShowQuestionHint,
  validateCommunityQuestion
} from '@/lib/community';
import { ensureLocaleResources, localizeCategory, localizeQuestion } from '@/lib/localization';
import { revealSection } from '@/lib/ui/revealSection';
import { getMultiplayerCopy } from '@/lib/multiplayer/localization';
import { API_QUESTION_EXCLUDE_MAX, CLIENT_SEEN_QUESTION_LIMIT } from '@/lib/services/questionSampling';
import { isPlayableQuestion } from '@/lib/services/questionValidation';
import { playAudioEvent, setAudioEnabled } from '@/lib/audio';
import { playRewardCelebration } from '@/lib/audio/reward';
import { createCelebrationTracker } from '@/lib/rewards/celebration';
import { RewardConfetti } from '@/components/trivia/chrome/RewardConfetti';
import { setHapticsEnabled } from '@/lib/haptics';
import { fetchRewardsSummary, submitGameResult } from '@/lib/rewards/client';
import type { RevealItem } from '@/lib/rewards/types';
import { Journey } from '@/components/trivia/screens/Journey';
import { applyPurchase, availablePot, canActivateLifeline, extraLifeCost, guaranteedForRung, lifelinePrice, payoutFor, SOLO_INITIAL_LIVES } from '@/lib/gameplay/economy';
import { pushScreen, replaceTop, sanitizeTarget } from '@/lib/navigation/screenStack';
import { applyGameToLocalProgression, readLocalProgression } from '@/lib/progression/local';
import type { PlayerProgressionState } from '@/lib/progression/types';
import type { LeaderboardEntry } from '@/lib/domain/models';
import { createAuthService } from '@/lib/auth/authService';
import { createBrowserSupabaseClient } from '@/lib/auth/supabaseBrowserClient';
import type { Locale, Question } from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import { Categories } from '@/components/trivia/screens/Categories';
import { LaunchTransition } from '@/components/trivia/LaunchTransition';
import { Contact } from '@/components/trivia/screens/Contact';
import { Header } from '@/components/trivia/screens/Header';
import { Home } from '@/components/trivia/screens/Home';
import { Leaderboard } from '@/components/trivia/screens/Leaderboard';
import { Result } from '@/components/trivia/screens/Result';
import { Rules } from '@/components/trivia/screens/Rules';
import { SettingsPanel } from '@/components/trivia/screens/SettingsPanel';
import { fmt, money, validateNickname } from '@/components/trivia/format';
import { getAuthUi, getCommunityUi, getTriviaUi } from '@/components/trivia/i18n';
import { Field, Metric } from '@/components/trivia/primitives';
import type { EndState, GameQuestion, LeaderboardStatus, Lifeline, PublicAuthUser, Screen, Settings, Stats } from '@/components/trivia/types';
import { LanguageMenu } from '@/components/trivia/chrome/LanguageMenu';
import { Particles } from '@/components/trivia/chrome/Particles';
import { PublicAuthArea } from '@/components/trivia/chrome/PublicAuthArea';
import { HomeDock } from '@/components/trivia/chrome/HomeDock';
import { GameExitModal } from '@/components/trivia/modals/GameExitModal';
import { LifeOfferModal } from '@/components/trivia/modals/LifeOfferModal';
import { ProgressionToasts, type ProgressionToast } from '@/components/trivia/ProgressionToasts';
import { ACHIEVEMENT_KEYS } from '@/components/trivia/i18n';
import { PaidModal } from '@/components/trivia/modals/PaidModal';
import { Game, type GamePhase } from '@/components/trivia/screens/Game';
import { completesMilestone, currentMilestoneIndex } from '@/components/trivia/milestones';
import { RewardsProfile } from '@/components/trivia/screens/RewardsProfile';
import { CORRECT_FEEDBACK_MS, LETTERS, MILESTONE_FEEDBACK_MS, MONEY, OPTION_LETTERS, SAFE_STEPS, SOLO_TIMER_SECONDS, WRONG_FEEDBACK_MS } from '@/components/trivia/constants';

const AUTO_ADVANCE_MS = 2200;
const STATS_KEY = 'premium-trivia-stats-v3';
const SETTINGS_KEY = 'premium-trivia-settings-v3';
const EXTRA_KEY = 'premium-trivia-extra-questions-v3';
const SEEN_QUESTIONS_KEY = 'premium-trivia-seen-question-ids-v1';
const COMMUNITY_KEY = 'premium-trivia-community-submissions-v1';
const AUDIT_KEY = 'premium-trivia-audit-log-v1';
const NICKNAME_KEY = 'premium-trivia-public-nickname-v1';
const LOCALE_KEY = 'premium-trivia-locale-v1';
const SUPPORTED_LOCALES: Locale[] = ['he', 'en', 'ar', 'ru'];
const SCREEN_MEMORY_KEY = 'premium-trivia-screen-v1';
// Screens that can be restored after back/forward navigation. Live-state
// screens (game, result) cannot be resurrected after a reload.
const RESTORABLE_SCREENS: Screen[] = ['home', 'categories', 'rules', 'leaderboard', 'profile', 'settings', 'submit', 'contact', 'multiplayer'];
/** History-entry payload key for the in-app navigation stack. */
type ScreenHistoryState = { tqsScreen?: Screen; tqsIndex?: number } | null;
function normalize(question: Question): GameQuestion {
  const answers = question.options || (question as unknown as { answers?: string[] }).answers || [];
  return {
    ...question,
    question: String(question.question || '')
      .replace(/^שאלת ידע:\s*/u, '')
      .replace(/^בחרו את התשובה הנכונה:\s*/u, '')
      .replace(/^מהי התשובה המדויקת לשאלה הבאה:\s*/u, '')
      .replace(/^בשעשועון הידע:\s*/u, '')
      .trim(),
    answers,
    options: answers
  };
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function emptyQuestion(): GameQuestion {
  return {
    id: `local-${Date.now()}`,
    category: 'ידע כללי',
    difficulty: 'בינוני',
    question: '',
    answers: ['', '', '', ''],
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  };
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function questionId(question: Pick<Question, 'id'>) {
  return String(question.id);
}

function uniqueRecentQuestionIds(ids: string[], limit = CLIENT_SEEN_QUESTION_LIMIT) {
  const unique = new Map<string, string>();
  for (const id of ids) {
    if (!id) continue;
    unique.delete(id);
    unique.set(id, id);
  }
  return Array.from(unique.values()).slice(-limit);
}

function legacyCurrencyAchievement() {
  return `מיליון ${String.fromCharCode(1513, 1511, 1500, 1497, 1501)}`;
}

function normalizeStats(stats: Stats): Stats {
  return {
    ...stats,
    achievements: stats.achievements.map(item => item === legacyCurrencyAchievement() ? 'מיליון דולר' : item)
  };
}

export default function TriviaPlatform({
  questions,
  initialScreen = 'home',
  adminHeader
}: {
  questions: Question[];
  totalAvailableQuestions?: number;
  initialScreen?: Screen;
  adminHeader?: ReactNode;
}) {
  const [loadedQuestions, setLoadedQuestions] = useState<Question[]>(questions);
  const baseQuestions = useMemo(() => loadedQuestions.map(normalize), [loadedQuestions]);
  const [locale, setLocale] = useState<Locale>('he');
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [extraQuestions, setExtraQuestions] = useState<GameQuestion[]>([]);
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>({ sound: true, effects: true, timer: 'דרמטית' });
  const [stats, setStats] = useState<Stats>({ games: 0, bestPrize: 0, totalMoney: 0, correct: 0, lifelines: 0, achievements: ['כניסה לאולפן'] });
  const [category, setCategory] = useState('הכול');
  const [gameSet, setGameSet] = useState<GameQuestion[]>([]);
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState([0, 1, 2, 3]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hiddenAnswers, setHiddenAnswers] = useState<number[]>([]);
  const [timer, setTimer] = useState(SOLO_TIMER_SECONDS);
  const [chances, setChances] = useState(SOLO_INITIAL_LIVES);
  // Economy state: which question is on stage (decoupled from the ladder
  // rung), everything spent in-game, and the one-time extra-life offer.
  const [questionIndex, setQuestionIndex] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [extraLifeUsed, setExtraLifeUsed] = useState(false);
  const [lifeOffer, setLifeOffer] = useState<{ cost: number; reason: EndState } | null>(null);
  const [progressionToasts, setProgressionToasts] = useState<ProgressionToast[]>([]);
  // Server-computed post-game reward ceremony (Result screen only; never the HUD).
  const [rewardReveals, setRewardReveals] = useState<RevealItem[]>([]);
  // Progressive disclosure: the Home "Journey" entry appears only once earned.
  const [journeyVisible, setJourneyVisible] = useState(false);
  const [lifelineUses, setLifelineUses] = useState<Record<Lifeline, number>>({ fifty: 0, swap: 0, phone: 0, audience: 0 });
  // One-lifeline-per-question lock: which lifeline (if any) was already used on
  // the current question. Non-null locks EVERY tile until the next question.
  const [lifelineUsedThisQuestion, setLifelineUsedThisQuestion] = useState<Lifeline | null>(null);
  const [advice, setAdvice] = useState('');
  const [notice, setNotice] = useState('');
  const [startError, setStartError] = useState('');
  const [launching, setLaunching] = useState(false);
  const [milestoneClimb, setMilestoneClimb] = useState<number | null>(null);
  const [pendingPaid, setPendingPaid] = useState<{ type: Lifeline; price: number } | null>(null);
  const [exitPrompt, setExitPrompt] = useState(false);
  const screenSectionRef = useRef<HTMLDivElement | null>(null);
  // In-app navigation stack (mirrors browser history; see commitScreen).
  const stackRef = useRef<Screen[]>([initialScreen === 'admin' ? 'admin' : initialScreen]);
  const liveGameRef = useRef(false);
  // Synchronous mirror of lifelineUses: two taps landing in the same event
  // batch must not both read the pre-update count (that would grant a free
  // second use, bypassing the official 50% price and the confirm dialog).
  const lifelineUsesRef = useRef<Record<Lifeline, number>>({ fifty: 0, swap: 0, phone: 0, audience: 0 });
  // Synchronous mirror of the per-question lock so two taps in one event batch
  // can never both pass the "a lifeline was already used this question" gate.
  const lifelineUsedThisQuestionRef = useRef<Lifeline | null>(null);
  // Synchronous mirror of the open paid dialog: no second lifeline can be
  // triggered while a purchase confirmation is pending.
  const pendingPaidRef = useRef<{ type: Lifeline; price: number } | null>(null);
  const lifelineTapAtRef = useRef(0);
  const [endState, setEndState] = useState<EndState>('lost');
  const [finalPrize, setFinalPrize] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [search, setSearch] = useState('');
  const [adminCategory, setAdminCategory] = useState('הכול');
  const [form, setForm] = useState<GameQuestion>(emptyQuestion());
  const [importText, setImportText] = useState('');
  const [sent, setSent] = useState(false);
  const [communitySubmissions, setCommunitySubmissions] = useState<CommunitySubmission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [communityInput, setCommunityInput] = useState({ question: '', answer: '' });
  const [communityMessage, setCommunityMessage] = useState('');
  const [communityProviderLabel, setCommunityProviderLabel] = useState('Local automation ready');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>('idle');
  const [nickname, setNicknameState] = useState('');
  // Static default for SSR/hydration parity; the mount effect loads the stored value.
  const [progression, setProgression] = useState<PlayerProgressionState>({ playerKey: 'local-player', xp: 0, level: 1, gamesPlayed: 0, unlockedAchievements: [], updatedAt: '' });
  const [authUser, setAuthUser] = useState<PublicAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const advanceTimeoutRef = useRef<number | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('question');
  const [milestoneCorrect, setMilestoneCorrect] = useState<number | null>(null);
  const seqTimersRef = useRef<number[]>([]);
  const advancingRef = useRef(false);
  // Stage 25 — the reward-celebration tracker survives re-renders (a ref) and is
  // reset only when a genuinely new Solo game starts; confettiBurst is a timestamp
  // key so a re-render/restoration can never replay the celebration.
  const celebrationRef = useRef(createCelebrationTracker());
  const [confettiBurst, setConfettiBurst] = useState(0);
  const startingRef = useRef(false);

  const t = getTriviaUi(locale);
  const authT = getAuthUi(locale);
  const communityT = getCommunityUi(locale);
  const multiplayerCopy = getMultiplayerCopy(locale);
  const dir = locale === 'he' || locale === 'ar' ? 'rtl' : 'ltr';
  const allQuestions = useMemo(() => [...extraQuestions, ...baseQuestions], [extraQuestions, baseQuestions]);
  // Localization integrity: non-Hebrew players only receive questions with a
  // complete translation for their locale, so mixed-language content can never
  // appear in gameplay. Hebrew (the source language) gets the full bank.
  const playableQuestions = useMemo(
    () => (locale === 'he' ? allQuestions : allQuestions.filter(question => question.translations?.[locale])),
    [allQuestions, locale]
  );
  // Categories are derived from the locale-playable pool so non-Hebrew players
  // never see categories that would have zero playable questions.
  const categories = useMemo(() => Array.from(new Set(playableQuestions.map(question => question.category))).sort(), [playableQuestions]);
  const current = gameSet[questionIndex] ? localizeQuestion(gameSet[questionIndex], locale) : undefined;
  // All money figures come from the economy module — the pot reflects every
  // in-game purchase and can never go negative.
  const currentPrize = availablePot(MONEY, round, deductions);
  const guaranteedPrize = guaranteedForRung(MONEY, round);
  const progress = Math.round(((round + 1) / 15) * 100);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allQuestions.filter(item => {
      const text = [item.question, item.category, item.difficulty, ...item.answers].join(' ').toLowerCase();
      return (adminCategory === 'הכול' || item.category === adminCategory) && (!q || text.includes(q));
    }).slice(0, 450);
  }, [adminCategory, allQuestions, search]);

  useEffect(() => {
    setExtraQuestions(readLocal(EXTRA_KEY, []));
    setSeenQuestionIds(uniqueRecentQuestionIds(readLocal<string[]>(SEEN_QUESTIONS_KEY, [])));
    setCommunitySubmissions(readLocal(COMMUNITY_KEY, []));
    setAuditLogs(readLocal(AUDIT_KEY, []));
    // Invitation deep-links (/?join=...) land directly on the multiplayer screen.
    if (new URLSearchParams(window.location.search).get('join')) {
      commitScreen('multiplayer', 'replace');
    } else {
      // Returning to the app (back/forward from /login etc.): the history
      // entry's own state is the source of truth; the session-scoped screen
      // memory remains as a fallback for browsers that drop history state.
      const historyScreen = (window.history.state as ScreenHistoryState)?.tqsScreen;
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      let restored: Screen | null = null;
      if (historyScreen && RESTORABLE_SCREENS.includes(historyScreen)) {
        restored = historyScreen;
      } else if (navigationEntry?.type === 'back_forward') {
        try {
          const storedScreen = sessionStorage.getItem(SCREEN_MEMORY_KEY) as Screen | null;
          if (storedScreen && RESTORABLE_SCREENS.includes(storedScreen)) restored = storedScreen;
        } catch { /* sessionStorage unavailable */ }
      }
      if (restored) {
        stackRef.current = restored === 'home' ? ['home'] : ['home', restored];
        commitScreen(restored, 'replace');
      } else {
        // Seed the first entry so popstate always has app state to return to.
        commitScreen(initialScreen === 'admin' ? 'admin' : initialScreen, 'replace');
      }
    }
    setSettings(readLocal(SETTINGS_KEY, { sound: true, effects: true, timer: 'דרמטית' }));
    setStats(normalizeStats(readLocal(STATS_KEY, { games: 0, bestPrize: 0, totalMoney: 0, correct: 0, lifelines: 0, achievements: ['כניסה לאולפן'] })));
    setNicknameState(readLocal(NICKNAME_KEY, ''));
    void refreshLeaderboard();
  }, []);

  // Session-scoped screen memory: lets back/forward navigation return to the
  // screen the user actually left (see the restore in the mount effect above).
  useEffect(() => {
    try { sessionStorage.setItem(SCREEN_MEMORY_KEY, screen); } catch { /* unavailable */ }
  }, [screen]);

  // Browser/hardware Back inside the app: walk the in-app stack. Entries
  // without app state (the page before the site) are left to the browser —
  // that is the only way Back leaves the site.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as ScreenHistoryState;
      const target = state?.tqsScreen;
      if (!target) return;
      // A live game may be resumed within the session; anything else that is
      // not restorable (game after reload, admin) falls back safely.
      const restorable: Screen[] = liveGameRef.current
        ? [...RESTORABLE_SCREENS, 'game', 'result']
        : [...RESTORABLE_SCREENS, 'result'];
      const safe = sanitizeTarget<Screen>(target, restorable, 'categories');
      const index = typeof state?.tqsIndex === 'number' ? state.tqsIndex : 0;
      stackRef.current = stackRef.current.slice(0, index).concat(safe);
      clearAdvanceTimer();
      setScreen(safe);
      if (safe !== target) {
        try { window.history.replaceState({ ...window.history.state, tqsScreen: safe, tqsIndex: index }, ''); } catch { /* ignore */ }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // The audio engine follows the sound setting; components then emit
  // semantic events without threading the flag around.
  useEffect(() => {
    setAudioEnabled(settings.sound);
  }, [settings.sound]);

  // Haptics ride the "effects" toggle and are independent of sound, so a muted
  // player can still feel the game. No-op where the Vibration API is absent.
  useEffect(() => {
    setHapticsEnabled(settings.effects);
  }, [settings.effects]);

  // Progressive disclosure: reveal the Home "Journey" entry only once the player
  // has earned it (played at least one game). Fire-and-forget; failure hides it.
  useEffect(() => {
    void fetchRewardsSummary().then(summary => {
      if (summary?.disclosure?.journeyVisible) setJourneyVisible(true);
    });
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    setAuthConfigured(Boolean(supabase));
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setAuthUser(data.user ? mapAuthUser(data.user) : null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ? mapAuthUser(session.user) : null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setLoadedQuestions(questions);
  }, [questions]);

  // Restore the previously chosen language (locale is client-only state; the
  // server always renders Hebrew first — see documented limitation). Locale
  // dictionaries are code-split per language, so load the resources before
  // applying the locale — the UI then renders fully translated in one step.
  useEffect(() => {
    const stored = readLocal<string>(LOCALE_KEY, '');
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      void ensureLocaleResources(stored as Locale).finally(() => setLocale(stored as Locale));
    }
  }, []);

  // Hydrate locally persisted progression after mount (SSR renders the default).
  useEffect(() => {
    setProgression(readLocalProgression());
  }, []);

  function changeLocale(next: Locale) {
    void ensureLocaleResources(next).finally(() => setLocale(next));
  }

  // Reflect the active locale on the document root so screen readers and search
  // engines get the correct language + direction (LTR for en/ru, RTL for
  // he/ar) instead of the SSR Hebrew/RTL default, and persist the choice.
  useEffect(() => {
    try { localStorage.setItem(LOCALE_KEY, JSON.stringify(locale)); } catch { /* storage may be unavailable */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);

  useEffect(() => {
    // The moderation feed exists only for the (legacy) in-platform admin
    // screen; public visitors must never call the admin-guarded endpoint.
    if (initialScreen !== 'admin') return;
    let active = true;
    fetch('/api/community/submissions', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : undefined)
      .then(data => {
        if (!active || !data?.ok) return;
        if (Array.isArray(data.submissions)) setCommunitySubmissions(data.submissions);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        setCommunityProviderLabel(data.provider === 'database' ? 'Supabase + AI moderation ready' : 'Local JSON + mock AI ready');
      })
      .catch(() => setCommunityProviderLabel('Local automation ready'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extraQuestions));
  }, [extraQuestions]);

  useEffect(() => {
    localStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify(seenQuestionIds));
  }, [seenQuestionIds]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(communitySubmissions));
  }, [communitySubmissions]);

  useEffect(() => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // One reusable reveal for every dynamically opened section: scroll its
  // heading under the fixed bar and move focus there (see revealSection).
  useEffect(() => {
    revealSection(screenSectionRef.current);
  }, [screen, questionIndex]);

  useEffect(() => {
    if (screen !== 'game' || gamePhase !== 'question' || selected !== null || lifeOffer !== null) return;
    if (timer <= 0) {
      loseChance('timeout');
      return;
    }
    const id = window.setTimeout(() => {
      setTimer(value => value - 1);
      if (timer <= 6) playAudioEvent('timer.tick');
    }, 1000);
    return () => window.clearTimeout(id);
  }, [screen, gamePhase, selected, settings.sound, timer, lifeOffer]);

  useEffect(() => {
    if (screen !== 'game') return;
    const id = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  useEffect(() => () => clearAdvanceTimer(), []);
  useEffect(() => { if (screen !== 'game') clearSeq(); return () => clearSeq(); }, [screen]);

  function clearAdvanceTimer() {
    if (advanceTimeoutRef.current === null) return;
    window.clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = null;
  }

  function scheduleAdvance(callback: () => void) {
    clearAdvanceTimer();
    advanceTimeoutRef.current = window.setTimeout(() => {
      advanceTimeoutRef.current = null;
      callback();
    }, AUTO_ADVANCE_MS);
  }

  // Stage 20C — one owned queue for the answer/milestone sequence, cleared on any
  // exit/unmount so a stale transition can never fire after leaving gameplay.
  function clearSeq() {
    seqTimersRef.current.forEach(id => window.clearTimeout(id));
    seqTimersRef.current = [];
  }
  function seq(callback: () => void, ms: number) {
    seqTimersRef.current.push(window.setTimeout(callback, ms));
  }

  async function refreshLeaderboard() {
    setLeaderboardStatus(currentStatus => currentStatus === 'saving' ? currentStatus : 'loading');
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.entries)) {
        setLeaderboardEntries(data.entries as LeaderboardEntry[]);
        setLeaderboardStatus(currentStatus => currentStatus === 'saving' ? currentStatus : 'idle');
        return;
      }
    } catch {
      // The game remains fully playable if the optional leaderboard endpoint is unavailable.
    }
    setLeaderboardStatus(currentStatus => currentStatus === 'saving' ? currentStatus : 'error');
  }

  async function saveNickname(value: string) {
    const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 20);
    const validation = validateNickname(cleaned, authT);
    if (!validation.ok) {
      setLeaderboardStatus('error');
      return;
    }

    setLeaderboardStatus('saving');
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: cleaned, prize: 0, correctCount: 0, claimOnly: true })
      });
      const data = await response.json();

      if (response.status === 409 || data?.status === 'nickname_taken') {
        setLeaderboardStatus('taken');
        return;
      }

      if (response.ok && data?.ok) {
        localStorage.setItem(NICKNAME_KEY, JSON.stringify(cleaned));
        setNicknameState(cleaned);
        if (Array.isArray(data.entries)) setLeaderboardEntries(data.entries as LeaderboardEntry[]);
        setLeaderboardStatus('saved');
        return;
      }
    } catch {
      // Handled by the error state below.
    }
    setLeaderboardStatus('error');
  }

  async function signOut() {
    await createAuthService().signOut();
    // Stage 17 — clear the authenticated identity AND route to a clean guest
    // screen, so no authenticated personal screen (Profile/Journey) can keep
    // rendering the signed-out user's server data while still mounted.
    setAuthUser(null);
    open('home');
  }

  async function submitLeaderboardScore(publicNickname: string, prize: number, correctCount: number) {
    if (!publicNickname.trim()) return;
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: publicNickname, prize, correctCount })
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.entries)) setLeaderboardEntries(data.entries as LeaderboardEntry[]);
      if (response.status === 409) setLeaderboardStatus('taken');
    } catch {
      setLeaderboardStatus('error');
    }
  }

  /**
   * The single navigation entry point (native-app model: one screen stack,
   * mirrored into browser history). Every user navigation pushes a history
   * entry carrying the target screen, so the browser/hardware Back button
   * walks the app's own screens before it can ever leave the site.
   */
  function open(next: Screen) {
    // The admin dashboard is only reachable through the protected /admin route;
    // the public app never navigates to it (server-side guards protect the data).
    if (next === 'admin' && initialScreen !== 'admin') return;
    clearAdvanceTimer();
    commitScreen(next, 'push');
    playAudioEvent('ui.tap');
  }

  /** Applies a screen change and keeps stack + browser history in sync. */
  function commitScreen(next: Screen, mode: 'push' | 'replace' | 'restore') {
    setScreen(next);
    if (typeof window === 'undefined') return;
    try {
      // Merge into the existing entry state: Next.js stores its own router
      // internals in history.state, and clobbering them breaks soft navigation.
      if (mode === 'push') {
        stackRef.current = pushScreen(stackRef.current, next);
        window.history.pushState({ ...window.history.state, tqsScreen: next, tqsIndex: stackRef.current.length - 1 }, '');
      } else if (mode === 'replace') {
        stackRef.current = replaceTop(stackRef.current, next);
        window.history.replaceState({ ...window.history.state, tqsScreen: next, tqsIndex: stackRef.current.length - 1 }, '');
      }
      // 'restore' (popstate): the browser already moved; stackRef is synced by the handler.
    } catch { /* history unavailable (very old browsers) — screen still changes */ }
  }

  function rememberSeenQuestions(items: Pick<Question, 'id'>[]) {
    if (!items.length) return;
    setSeenQuestionIds(previous => uniqueRecentQuestionIds([...previous, ...items.map(questionId)]));
  }

  async function loadCategoryQuestions(nextCategory: string) {
    if (locale !== 'he') return [];
    try {
      const isSpecificCategory = categories.includes(nextCategory);
      const params = new URLSearchParams({ limit: isSpecificCategory ? '240' : '640' });
      if (isSpecificCategory) params.set('category', nextCategory);
      const excludedIds = uniqueRecentQuestionIds([...seenQuestionIds, ...gameSet.map(questionId)]).slice(-API_QUESTION_EXCLUDE_MAX);
      if (excludedIds.length) params.set('exclude', excludedIds.join(','));
      const response = await fetch(`/api/questions?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data?.questions)) return [];
      setLoadedQuestions(current => {
        const existing = new Set(current.map(question => String(question.id)));
        const additions = (data.questions as Question[]).filter(question => !existing.has(String(question.id)));
        return additions.length ? [...current, ...additions] : current;
      });
      return (data.questions as Question[]).map(normalize);
    } catch {
      return [];
    }
  }

  async function startGame(nextCategory = category) {
    if (startingRef.current) return; // guard against duplicate starts
    startingRef.current = true;
    // Cinematic interstitial: show the million-dollar hero + stacking ladder
    // while the round is dealt, held for a minimum beat so it always plays.
    setLaunching(true);
    const launchAnimation = new Promise<void>(resolve => setTimeout(resolve, 3000));
    setStartError('');
    clearAdvanceTimer();
    advancingRef.current = false;
    const seenSet = new Set(seenQuestionIds);
    const isSpecificCategory = categories.includes(nextCategory);
    let available = shuffle(playableQuestions.filter(question => !isSpecificCategory || question.category === nextCategory));
    const additional = await loadCategoryQuestions(nextCategory);
    if (additional.length > 0) {
      const existing = new Set(available.map(question => String(question.id)));
      const additions = additional.filter(question => !existing.has(String(question.id)));
      const freshAdditions = additions.filter(question => !seenSet.has(questionId(question)));
      const fallbackAdditions = additions.filter(question => seenSet.has(questionId(question)));
      available = [...freshAdditions, ...available, ...fallbackAdditions];
    }
    const unseenAvailable = available.filter(question => !seenSet.has(questionId(question)));
    if (unseenAvailable.length >= 4) {
      const seenAvailable = available.filter(question => seenSet.has(questionId(question)));
      available = [...unseenAvailable, ...seenAvailable];
    }
    if (additional.length === 0 && available.filter(question => !seenSet.has(questionId(question))).length < 15) {
      const fallbackAdditional = await loadCategoryQuestions(nextCategory);
      if (fallbackAdditional.length > 0) {
        const existing = new Set(available.map(question => String(question.id)));
        const additions = fallbackAdditional.filter(question => !existing.has(String(question.id)));
        const freshAdditions = additions.filter(question => !seenSet.has(questionId(question)));
        const fallbackAdditions = additions.filter(question => seenSet.has(questionId(question)));
        available = [...freshAdditions, ...available, ...fallbackAdditions];
      }
    }
    // Strict boundary: only fully playable questions may reach gameplay.
    available = available.filter(isPlayableQuestion);
    if (available.length < 4) {
      // Never a silent no-op: surface a recoverable error and stay on Categories.
      startingRef.current = false;
      setLaunching(false);
      setStartError(t.startNoQuestions || 'No questions are available right now. Please try another category.');
      playAudioEvent('ui.error');
      return;
    }
    let pool = available.slice(0, 15);
    if (pool.length < 15) {
      const filled: GameQuestion[] = [];
      while (filled.length < 15) filled.push(...shuffle(available));
      pool = filled.slice(0, 15);
    }
    setCategory(nextCategory);
    setGameSet(pool);
    rememberSeenQuestions(pool);
    setRound(0);
    setQuestionIndex(0);
    setDeductions(0);
    setExtraLifeUsed(false);
    setLifeOffer(null);
    setOrder(shuffle([0, 1, 2, 3]));
    setSelected(null);
    setHiddenAnswers([]);
    setTimer(SOLO_TIMER_SECONDS);
    setChances(SOLO_INITIAL_LIVES);
    lifelineUsesRef.current = { fifty: 0, swap: 0, phone: 0, audience: 0 };
    setLifelineUses({ fifty: 0, swap: 0, phone: 0, audience: 0 });
    lifelineUsedThisQuestionRef.current = null;
    pendingPaidRef.current = null;
    setLifelineUsedThisQuestion(null);
    setAdvice('');
    setNotice('');
    setElapsed(0);
    liveGameRef.current = true;
    // The launch interstitial is the only pre-game animation now — go straight
    // to the first question when it ends (no second, redundant intro ladder).
    setGamePhase('question');
    setMilestoneCorrect(null);
    celebrationRef.current.reset();
    setConfettiBurst(0);
    // Hold the interstitial for its full 3s beat before the stage takes over.
    await launchAnimation;
    commitScreen('game', 'push');
    playAudioEvent('game.start');
    setLaunching(false);
    startingRef.current = false;
  }

  /** Puts the next question on stage without touching the ladder. */
  function presentNextQuestion() {
    clearAdvanceTimer();
    advancingRef.current = false;
    const nextIndex = questionIndex + 1;
    setGameSet(previous => {
      if (previous[nextIndex]) return previous;
      // Wrong answers consume questions without climbing, so the set can run
      // past its initial 15 — extend it from the playable pool.
      const usedIds = new Set(previous.map(item => item.id));
      const seenSet = new Set(seenQuestionIds);
      const pool = shuffle(playableQuestions.filter(question => !usedIds.has(question.id) && isPlayableQuestion(question)));
      const fresh = pool.find(question => !seenSet.has(questionId(question))) || pool[0];
      if (fresh) {
        rememberSeenQuestions([fresh]);
        return [...previous, fresh];
      }
      // Exhausted pool: repeat an earlier question rather than blanking the game.
      return [...previous, previous[nextIndex % previous.length]];
    });
    setQuestionIndex(nextIndex);
    setOrder(shuffle([0, 1, 2, 3]));
    setSelected(null);
    setHiddenAnswers([]);
    setTimer(SOLO_TIMER_SECONDS);
    setAdvice('');
    setNotice('');
    // New question: clear ONLY the per-question lock. Game-level usage counters
    // (lifelineUses) deliberately persist so pricing and the 2-per-game cap hold.
    lifelineUsedThisQuestionRef.current = null;
    setLifelineUsedThisQuestion(null);
  }

  /** Correct answer: secure the rung and climb. The only path that raises the pot. */
  function climbLadder() {
    clearAdvanceTimer();
    if (round >= 14) {
      finishWithReason('win');
      return;
    }
    if (SAFE_STEPS.includes(round)) playAudioEvent('prize.milestone');
    playAudioEvent('reward.up'); // winnings rise -> elegant upward accent
    setRound(value => value + 1);
    presentNextQuestion();
  }

  /** Third life lost: one dramatic chance to buy a single life for half the pot. */
  function handleFinalLifeLost(reason: EndState) {
    clearAdvanceTimer();
    advancingRef.current = false;
    if (!extraLifeUsed) {
      setLifeOffer({ cost: extraLifeCost(MONEY, round, deductions), reason });
      return;
    }
    finishWithReason(reason);
  }

  function acceptLifeOffer() {
    if (!lifeOffer) return;
    setDeductions(value => applyPurchase(value, lifeOffer.cost));
    setExtraLifeUsed(true);
    setChances(1);
    setLifeOffer(null);
    playAudioEvent('lifeline.used');
    playAudioEvent('reward.down');
    presentNextQuestion();
  }

  function declineLifeOffer() {
    if (!lifeOffer) return;
    const reason = lifeOffer.reason;
    setLifeOffer(null);
    finishWithReason(reason);
  }

  /** Every game ending settles through the economy module. */
  function finishWithReason(reason: EndState) {
    finish(reason, payoutFor(MONEY, reason === 'win' ? MONEY.length : round, deductions, reason === 'win' ? 'win' : reason === 'quit' ? 'quit' : reason === 'timeout' ? 'timeout' : 'lost'));
  }

  function completeAnsweredQuestion(answerIndex: number) {
    if (!current) return;
    if (answerIndex === current.correctIndex) {
      climbLadder();
      return;
    }
    // Wrong answer: never climbs the ladder, never awards the rung prize.
    if (chances > 1) {
      setChances(value => value - 1);
      presentNextQuestion();
      return;
    }
    handleFinalLifeLost('lost');
  }

  // Stage 20C — answering drives an explicit auto-advance sequence: brief blue/
  // red feedback, an optional cinematic milestone advance, then the next question.
  // No manual Next button. completeAnsweredQuestion is called with the captured
  // index (not from state) so the render closure stays correct.
  function resolveAnswer(index: number) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    clearAdvanceTimer();
    completeAnsweredQuestion(index);
  }
  function chooseAnswer(index: number) {
    if (!current || selected !== null || gamePhase !== 'question') return;
    setSelected(index);
    const correct = index === current.correctIndex;
    playAudioEvent(correct ? 'answer.correct' : 'answer.wrong');
    setAdvice('');
    setGamePhase('feedback');
    clearSeq();
    const nextCorrect = round + 1;
    if (correct && nextCorrect < 15 && completesMilestone(nextCorrect)) {
      // Blue verdict stays readable, then the cinematic climb overlay: the full
      // prize ladder in place with a gold marker climbing one rung, held for a
      // 3s beat that fades in and out, then the next question.
      seq(() => {
        setMilestoneCorrect(nextCorrect);
        setMilestoneClimb(currentMilestoneIndex(nextCorrect));
        // Stage 25 — a real prize-ladder ADVANCEMENT (the silent intro never reaches
        // here). Count it once per completed stage; fire the tiered reward only when
        // the tab is visible so a backgrounded burst is never replayed on return.
        const advancement = celebrationRef.current.advance(nextCorrect);
        const celebrateVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
        if (advancement > 0 && celebrateVisible) {
          playRewardCelebration(advancement);
          if (advancement === 3 && settings.effects) setConfettiBurst(Date.now());
        }
        if (SAFE_STEPS.includes(round)) playAudioEvent('prize.milestone');
        seq(() => {
          setMilestoneClimb(null);
          setMilestoneCorrect(null);
          setGamePhase('question');
          resolveAnswer(index);
        }, 3000);
      }, MILESTONE_FEEDBACK_MS);
    } else {
      // Stage 22 — hold the blue/red verdict ~1.5s longer for comprehension.
      seq(() => {
        setGamePhase('question');
        resolveAnswer(index);
      }, correct ? CORRECT_FEEDBACK_MS : WRONG_FEEDBACK_MS);
    }
  }

  function loseChance(reason: EndState) {
    if (reason === 'timeout') playAudioEvent('timer.expired');
    if (chances > 1) {
      setChances(value => value - 1);
      setNotice(reason === 'timeout' ? t.timeoutNotice : t.wrongNotice);
      scheduleAdvance(presentNextQuestion);
      return;
    }
    handleFinalLifeLost(reason);
  }

  function finish(state: EndState, prize: number) {
    clearAdvanceTimer();
    setRewardReveals([]);
    setEndState(state);
    setFinalPrize(prize);
    liveGameRef.current = false;
    commitScreen('result', 'replace');
    playAudioEvent(state === 'win' ? 'game.victory' : state === 'quit' ? 'game.cashout' : state === 'timeout' ? 'timer.expired' : 'game.defeat');
    const lifelines = Object.values(lifelineUses).reduce((sum, value) => sum + value, 0);
    setStats(previous => ({
      games: previous.games + 1,
      bestPrize: Math.max(previous.bestPrize, prize),
      totalMoney: previous.totalMoney + prize,
      correct: previous.correct + round,
      lifelines: previous.lifelines + lifelines,
      achievements: Array.from(new Set([...previous.achievements, prize >= 1000000 ? 'מיליון דולר' : prize >= 250000 ? 'שחקן בכיר' : 'משחק הושלם']))
    }));
    const progressionUpdate = applyGameToLocalProgression({
      mode: 'solo',
      won: state === 'win',
      correctAnswers: round,
      prize,
      lifelinesUsed: lifelines
    });
    // Reward chimes are staggered behind the end-of-game cue so the fanfare,
    // level-up and achievement sounds never stack on top of each other. Each
    // sound gets a matching toast on the same timeline so sight and sound land
    // together.
    if (progressionUpdate.state.level > progression.level) {
      const newLevel = progressionUpdate.state.level;
      window.setTimeout(() => {
        playAudioEvent('progression.levelUp');
        setProgressionToasts(previous => [...previous, { id: `level-${Date.now()}`, kind: 'level', text: fmt(t.levelUpToast, { level: newLevel }) }]);
      }, 900);
    }
    if (progressionUpdate.unlocked.length > 0) {
      const unlocked = progressionUpdate.unlocked;
      window.setTimeout(() => {
        playAudioEvent('progression.achievement');
        setProgressionToasts(previous => [
          ...previous,
          ...unlocked.map((achievement, index) => {
            const achievementId = typeof achievement === 'string' ? achievement : achievement.id;
            return {
              id: `ach-${Date.now()}-${index}`,
              kind: 'achievement' as const,
              text: fmt(t.achievementToast, { name: ACHIEVEMENT_KEYS[achievementId] ? t[ACHIEVEMENT_KEYS[achievementId]] : achievementId })
            };
          })
        ]);
      }, 1500);
    }
    setProgression(progressionUpdate.state);
    const publicNickname = nickname || readLocal(NICKNAME_KEY, '');
    if (publicNickname) {
      void submitLeaderboardScore(publicNickname, prize, Math.min(15, state === 'win' ? 15 : round));
    }
    // Record the game against the server rewards engine and surface the ordered
    // reward ceremony on the Result screen. Fire-and-forget: it can never affect
    // gameplay, and a failure simply yields no reveals.
    void submitGameResult({
      gameId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: 'solo',
      won: state === 'win',
      cashedOut: state === 'quit',
      correctAnswers: round,
      questionsFaced: round + (state === 'win' ? 0 : 1),
      prize,
      lifelinesUsed: lifelines,
      category,
      livesLostBeforeWin: Math.max(0, SOLO_INITIAL_LIVES - chances),
      leveledUp: progressionUpdate.state.level > progression.level,
      newLevel: progressionUpdate.state.level
    }).then(setRewardReveals);
  }

  function triggerLifeline(type: Lifeline) {
    if (!current) return;
    // Accidental double-taps must never consume two activations (at rung 0
    // both uses are legitimately free, so the price check alone can't stop it).
    const tappedAt = Date.now();
    if (tappedAt - lifelineTapAtRef.current < 350) return;
    lifelineTapAtRef.current = tappedAt;
    // Official rules (economy module): use 1 is free; use 2 opens the purchase
    // dialog and costs 25% of the pot, but ONLY once the pot is positive (never a
    // $0 purchase); use 3 never happens. Additionally, at most ONE lifeline of any
    // type may be used per question. canActivateLifeline enforces the cap, the pot
    // eligibility and the per-question lock; the pending-dialog guard stops a
    // second lifeline racing an open paid confirmation.
    if (pendingPaidRef.current !== null) return;
    const timesUsed = lifelineUsesRef.current[type];
    const anyUsedThisQuestion = lifelineUsedThisQuestionRef.current !== null;
    if (!canActivateLifeline(timesUsed, anyUsedThisQuestion, currentPrize)) return;
    const price = lifelinePrice(currentPrize, timesUsed);
    if (price === null) return; // defensive: canActivateLifeline already excludes exhaustion
    if (timesUsed >= 1) {
      // Paid second use: canActivate ensured the pot is positive, so the price is
      // never $0. Open the confirm dialog (mirrored synchronously).
      pendingPaidRef.current = { type, price };
      setPendingPaid({ type, price });
      return;
    }
    applyLifeline(type, 0);
  }

  function applyLifeline(type: Lifeline, price: number) {
    if (!current) return;
    // Synchronous allowance check: a double-tap (tile or confirm button), or a
    // tap on a DIFFERENT tile in the same batch, must apply exactly once — never a
    // second free use, never a double charge, never two lifelines on one question.
    // The per-question lock is a single global flag, not per type.
    const anyUsedThisQuestion = lifelineUsedThisQuestionRef.current !== null;
    if (!canActivateLifeline(lifelineUsesRef.current[type], anyUsedThisQuestion, currentPrize)) return;
    lifelineUsesRef.current = { ...lifelineUsesRef.current, [type]: lifelineUsesRef.current[type] + 1 };
    lifelineUsedThisQuestionRef.current = type;
    pendingPaidRef.current = null;
    setPendingPaid(null);
    setLifelineUses(previous => ({ ...previous, [type]: previous[type] + 1 }));
    setLifelineUsedThisQuestion(type);
    // Deduct the price BEFORE the effect is applied (official rule). A 0 price
    // (second use at rung 0) is a no-op purchase but the use is still consumed.
    if (price > 0) {
      setDeductions(value => applyPurchase(value, price));
      // Stage 23 — no "money deducted" message: the winnings count DOWN (existing
      // count-up in reverse) with an elegant downward tone say it all.
      playAudioEvent('reward.down');
    }
    playAudioEvent('lifeline.used');
    if (type === 'fifty') {
      setHiddenAnswers(order.filter(index => index !== current.correctIndex).slice(0, 2));
      setAdvice(t.fiftyAdvice);
    }
    if (type === 'swap') {
      const usedIds = new Set(gameSet.map(item => item.id));
      const seenSet = new Set(seenQuestionIds);
      const replacements = shuffle(playableQuestions.filter(question => question.category === gameSet[questionIndex].category && !usedIds.has(question.id) && isPlayableQuestion(question)));
      const replacement = replacements.find(question => !seenSet.has(questionId(question))) || replacements[0];
      if (replacement) {
        setGameSet(previous => previous.map((item, index) => index === questionIndex ? replacement : item));
        rememberSeenQuestions([replacement]);
        setOrder(shuffle([0, 1, 2, 3]));
        setHiddenAnswers([]);
        setAdvice(t.swapAdvice);
      }
    }
    if (type === 'phone') setAdvice(fmt(t.phoneAdvice, { answer: current.answers[current.correctIndex] }));
    if (type === 'audience') {
      const optionLetters = OPTION_LETTERS[locale] || LETTERS;
      setAdvice(fmt(t.audienceAdvice, { letter: optionLetters[order.indexOf(current.correctIndex)] }));
    }
  }

  function saveQuestion() {
    const normalized = { ...form, options: form.answers, question: form.question.trim() };
    setExtraQuestions(previous => {
      const exists = previous.some(question => question.id === normalized.id);
      return exists ? previous.map(question => question.id === normalized.id ? normalized : question) : [normalized, ...previous];
    });
    setForm(emptyQuestion());
    setSent(true);
    window.setTimeout(() => setSent(false), 1800);
  }

  function importQuestions() {
    try {
      const parsed = JSON.parse(importText);
      const incoming = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(incoming)) return;
      setExtraQuestions(previous => [...incoming.map(normalize), ...previous]);
      setImportText('');
    } catch {
      setNotice('הייבוא נכשל. בדקו שהטקסט הוא JSON תקין.');
    }
  }

  function exportQuestions() {
    const blob = new Blob([JSON.stringify({ schemaVersion: '2.0', questions: allQuestions }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'premium-trivia-questions.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitCommunityQuestion() {
    const question = communityInput.question.trim();
    const correctAnswer = communityInput.answer.trim();
    if (!question || !correctAnswer) {
      setCommunityMessage(communityT.incomplete);
      return;
    }
    setCommunityMessage('');
    try {
      const response = await fetch('/api/community/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, correctAnswer, language: locale })
      });
      const data = await response.json();
      if (response.ok && data?.ok) {
        playAudioEvent('ui.success');
        setCommunityMessage(communityT.received);
        setCommunityInput({ question: '', answer: '' });
        return;
      }
      setCommunityMessage(data?.error || communityT.failed);
    } catch {
      setCommunityMessage(communityT.failed);
    }
  }

  async function approveSubmission(id: string) {
    try {
      const response = await fetch(`/api/community/submissions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });
      const data = await response.json();
      if (response.ok && data?.ok && data.submission) {
        const submission = data.submission as CommunitySubmission;
        setCommunitySubmissions(previous => previous.map(item => item.id === id ? submission : item));
        const question = submission.question || submissionToQuestion(submission);
        setExtraQuestions(currentQuestions => currentQuestions.some(currentQuestion => currentQuestion.id === question.id)
          ? currentQuestions
          : [normalize(question), ...currentQuestions]
        );
        setAuditLogs(previous => [createAudit('admin_approved_submission', id, 'Question published from review queue'), ...previous].slice(0, 80));
        playAudioEvent('ui.success');
        return;
      }
    } catch {
      setCommunityProviderLabel('Local fallback active');
    }

    setCommunitySubmissions(previous => previous.map(item => {
      if (item.id !== id) return item;
      const question = item.question || submissionToQuestion(item);
      setExtraQuestions(currentQuestions => currentQuestions.some(currentQuestion => currentQuestion.id === question.id)
        ? currentQuestions
        : [normalize(question), ...currentQuestions]
      );
      return {
        ...item,
        updatedAt: new Date().toISOString(),
        moderation: { ...item.moderation, status: 'auto_approved', recommendation: 'Approved by admin.' },
        question
      };
    }));
    setAuditLogs(previous => [createAudit('admin_approved_submission', id, 'Question published from review queue'), ...previous].slice(0, 80));
    playAudioEvent('ui.success');
  }

  async function rejectSubmission(id: string) {
    try {
      const response = await fetch(`/api/community/submissions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      });
      const data = await response.json();
      if (response.ok && data?.ok && data.submission) {
        setCommunitySubmissions(previous => previous.map(item => item.id === id ? data.submission : item));
        setAuditLogs(previous => [createAudit('admin_rejected_submission', id, 'Question rejected from review queue'), ...previous].slice(0, 80));
        playAudioEvent('ui.error');
        return;
      }
    } catch {
      setCommunityProviderLabel('Local fallback active');
    }

    setCommunitySubmissions(previous => previous.map(item => item.id === id
      ? {
          ...item,
          updatedAt: new Date().toISOString(),
          moderation: { ...item.moderation, status: 'rejected', recommendation: 'Rejected by admin.' }
        }
      : item
    ));
    setAuditLogs(previous => [createAudit('admin_rejected_submission', id, 'Question rejected from review queue'), ...previous].slice(0, 80));
    playAudioEvent('ui.error');
  }

  return (
    <main className={`app-shell font-hebrew premium-typography ${screen === 'game' ? 'game-active' : ''} ${screen === 'admin' ? 'admin-active' : ''}`} dir={dir}>
      {settings.effects && <Particles />}
      <RewardConfetti burstId={confettiBurst} />
      {/* Single shared utility bar: language (physical left) and account (physical
          right) live in one flex row, so they can never overlap on any device.
          On Home + Categories it is replaced by the compact glass HomeDock (below). */}
      {screen !== 'home' && screen !== 'categories' && (
        <div className="top-utility-bar" dir="ltr">
          <div className="language-corner">
            <LanguageMenu locale={locale} setLocale={changeLocale} />
          </div>
          {screen !== 'admin' && (
            <div className="top-utility-auth" dir={dir}>
              <PublicAuthArea
                ui={authT}
                user={authUser}
                ready={authReady}
                configured={authConfigured}
                nickname={nickname}
                leaderboardStatus={leaderboardStatus}
                saveNickname={saveNickname}
                open={open}
                signOut={signOut}
              />
            </div>
          )}
        </div>
      )}
      {screen === 'admin' && adminHeader}
      {launching && <LaunchTransition />}
      {milestoneClimb !== null && <LaunchTransition mode="climb" climbTo={milestoneClimb} />}
      {/* Home + Categories use the consolidated glass dock; every other screen
          keeps the shared Header. Both route through the same handlers. */}
      {(screen === 'home' || screen === 'categories') && (
        <HomeDock
          t={t}
          authUi={authT}
          locale={locale}
          setLocale={changeLocale}
          submitLabel={communityT.submitNav}
          open={open}
          user={authUser}
          authReady={authReady}
          authConfigured={authConfigured}
          nickname={nickname}
          leaderboardStatus={leaderboardStatus}
          saveNickname={saveNickname}
          signOut={signOut}
        />
      )}
      {screen !== 'admin' && screen !== 'home' && screen !== 'categories' && <Header t={t} submitLabel={communityT.submitNav} multiplayerLabel={multiplayerCopy.nav} open={open} start={() => open('categories')} />}
      <div key={screen} ref={screenSectionRef} tabIndex={-1} className="screen-section">
      {screen === 'home' && <Home t={t} locale={locale} soloLabel={multiplayerCopy.solo} multiplayerLabel={multiplayerCopy.multiplayer} journeyVisible={journeyVisible} start={() => open('categories')} open={open} />}
      {screen === 'categories' && <Categories t={t} locale={locale} categories={categories} startGame={startGame} startError={startError} clearStartError={() => setStartError('')} />}
      {screen === 'multiplayer' && <MultiplayerMode locale={locale} initialNickname={nickname} isAuthenticated={Boolean(authUser)} saveProgressLabel={authT.saveProgress} />}
      {screen === 'journey' && <Journey t={t} locale={locale} />}
      {screen === 'rules' && <Rules t={t} start={() => open('categories')} />}
      {screen === 'submit' && (
        <CommunitySubmit
          ui={communityT}
          input={communityInput}
          setInput={setCommunityInput}
          submit={submitCommunityQuestion}
          message={communityMessage}
        />
      )}
      {screen === 'game' && current && (
        <Game
          t={t}
          locale={locale}
          current={current}
          round={round}
          order={order}
          selected={selected}
          hiddenAnswers={hiddenAnswers}
          timer={timer}
          currentPrize={currentPrize}
          chances={chances}
          lifelineUses={lifelineUses}
          lifelineUsedThisQuestion={lifelineUsedThisQuestion}
          advice={advice}
          notice={notice}
          gamePhase={gamePhase}
          ladderCorrect={milestoneCorrect ?? round}
          chooseAnswer={chooseAnswer}
          triggerLifeline={triggerLifeline}
          requestExit={() => setExitPrompt(true)}
        />
      )}
      {screen === 'result' && <Result t={t} authUi={authT} isAuthenticated={Boolean(authUser)} state={endState} correctCount={round} elapsed={elapsed} prize={finalPrize} reveals={rewardReveals} start={() => open('categories')} home={() => open('home')} />}
      {screen === 'admin' && (
        <Admin
          t={t}
          locale={locale}
          questions={allQuestions}
          filtered={filteredQuestions}
          search={search}
          setSearch={setSearch}
          category={adminCategory}
          setCategory={setAdminCategory}
          categories={categories}
          form={form}
          setForm={setForm}
          saveQuestion={saveQuestion}
          setExtraQuestions={setExtraQuestions}
          importText={importText}
          setImportText={setImportText}
          importQuestions={importQuestions}
          exportQuestions={exportQuestions}
          communityUi={communityT}
          communitySubmissions={communitySubmissions}
          communityProviderLabel={communityProviderLabel}
          auditLogs={auditLogs}
          approveSubmission={approveSubmission}
          rejectSubmission={rejectSubmission}
        />
      )}
      {screen === 'contact' && <Contact t={t} sent={sent} setSent={setSent} />}
      {screen === 'leaderboard' && (
        <Leaderboard
          t={t}
          entries={leaderboardEntries}
          status={leaderboardStatus}
          isAuthenticated={Boolean(authUser)}
          personalBest={stats.bestPrize}
          displayName={authUser?.displayName || ''}
        />
      )}
      {screen === 'profile' && <RewardsProfile t={t} locale={locale} displayName={nickname || authUser?.displayName || ''} />}
      {screen === 'settings' && <SettingsPanel t={t} settings={settings} setSettings={setSettings} reset={() => { localStorage.clear(); location.reload(); }} />}
      </div>
      {pendingPaid && <PaidModal t={t} pending={pendingPaid} pot={currentPrize} cancel={() => { pendingPaidRef.current = null; setPendingPaid(null); }} confirm={() => applyLifeline(pendingPaid.type, pendingPaid.price)} />}
      {lifeOffer && <LifeOfferModal t={t} cost={lifeOffer.cost} accept={acceptLifeOffer} decline={declineLifeOffer} />}
      <ProgressionToasts toasts={progressionToasts} remove={id => setProgressionToasts(previous => previous.filter(toast => toast.id !== id))} />
      {exitPrompt && (
        <GameExitModal
          t={t}
          stay={() => setExitPrompt(false)}
          cashOut={() => { setExitPrompt(false); clearSeq(); clearAdvanceTimer(); finishWithReason('quit'); }}
          leave={() => {
            setExitPrompt(false);
            clearAdvanceTimer();
            open('home');
          }}
        />
      )}
    </main>
  );
}

function CommunitySubmit(props: {
  ui: Record<string, string>;
  input: { question: string; answer: string };
  setInput: (input: { question: string; answer: string }) => void;
  submit: () => void;
  message: string;
}) {
  const { ui, input, setInput, submit, message } = props;
  const [touched, setTouched] = useState(false);
  const validation = validateCommunityQuestion(input.question, input.answer);
  const showQuestionError = shouldShowQuestionHint(input.question, touched);

  return (
    <section className="community-submit">
      <div className="community-submit-card glass">
        <h1 className="community-submit-title">{ui.submitTitle}</h1>
        <div className="community-field">
          <textarea
            className="community-question-input"
            placeholder={ui.questionPlaceholder}
            value={input.question}
            onChange={event => setInput({ ...input, question: event.target.value })}
            onBlur={() => setTouched(true)}
            rows={4}
            aria-label={ui.question}
            aria-invalid={showQuestionError || undefined}
            aria-describedby={showQuestionError ? 'community-q-hint' : undefined}
          />
          {showQuestionError && (
            <p id="community-q-hint" className="community-validate" role="status">
              <span>{ui.minChars}</span>
              <span className="community-counter" aria-hidden="true">{validation.meaningfulLength} / {validation.minLength}</span>
            </p>
          )}
        </div>
        <input
          className="community-answer-input"
          placeholder={ui.answerPlaceholder}
          value={input.answer}
          onChange={event => setInput({ ...input, answer: event.target.value })}
          aria-label={ui.answerLabel}
        />
        <button
          className="community-submit-button focus-ring"
          onClick={submit}
          disabled={!validation.canSubmit}
          aria-describedby="community-submit-hint"
        >
          {ui.send}
        </button>
        <span id="community-submit-hint" className="sr-only">{ui.submitHint}</span>
        {message && <p className="community-submit-note" role="status">{message}</p>}
      </div>
    </section>
  );
}

function Admin(props: {
  t: Record<string, string>;
  locale: Locale;
  questions: GameQuestion[];
  filtered: GameQuestion[];
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
  form: GameQuestion;
  setForm: (question: GameQuestion) => void;
  saveQuestion: () => void;
  setExtraQuestions: React.Dispatch<React.SetStateAction<GameQuestion[]>>;
  importText: string;
  setImportText: (value: string) => void;
  importQuestions: () => void;
  exportQuestions: () => void;
  communityUi: Record<string, string>;
  communitySubmissions: CommunitySubmission[];
  communityProviderLabel: string;
  auditLogs: AuditLogEntry[];
  approveSubmission: (id: string) => void | Promise<void>;
  rejectSubmission: (id: string) => void | Promise<void>;
}) {
  const { t, locale, questions, filtered, search, setSearch, category, setCategory, categories, form, setForm, saveQuestion, setExtraQuestions, importText, setImportText, importQuestions, exportQuestions, communityUi, communitySubmissions, communityProviderLabel, auditLogs, approveSubmission, rejectSubmission } = props;
  const pendingSubmissions = communitySubmissions.filter(item => item.moderation.status === 'needs_review');
  const approvedSubmissions = communitySubmissions.filter(item => item.moderation.status === 'auto_approved').length;
  const rejectedSubmissions = communitySubmissions.filter(item => item.moderation.status === 'rejected').length;
  return (
    <section className="mx-auto grid w-full max-w-[1680px] gap-6 px-5 pb-12 pt-8 lg:grid-cols-[430px_1fr] lg:px-8">
      <AdSlot placement="admin-top" className="lg:col-span-2" />
      <div className="glass rounded-[30px] p-6 lg:col-span-2">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-3xl font-black">{communityUi.dashboard}</h2>
            <p className="mt-2 text-white/60">{communityUi.localMode}</p>
          </div>
          <div className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-bold text-gold">{communityProviderLabel}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric value={String(communitySubmissions.length)} label={communityUi.submissions} />
          <Metric value={String(pendingSubmissions.length)} label={communityUi.pending} gold />
          <Metric value={String(approvedSubmissions)} label={communityUi.approved} />
          <Metric value={String(rejectedSubmissions)} label={communityUi.rejectedLabel} />
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5">
            <h3 className="mb-4 text-2xl font-black">{communityUi.reviewQueue}</h3>
            <div className="grid gap-3">
              {pendingSubmissions.length === 0 && <p className="rounded-2xl bg-white/[0.06] p-4 text-white/62">{communityUi.emptyQueue}</p>}
              {pendingSubmissions.map(item => (
                <article key={item.id} className="rounded-3xl border border-white/10 bg-black/18 p-4">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-gold/15 px-3 py-1 text-gold">{item.draft.category}</span>
                        <span className="rounded-full bg-azure/15 px-3 py-1 text-azure">{communityUi.confidence}: {item.moderation.score}</span>
                      </div>
                      <h4 className="text-xl font-extrabold">{item.moderation.normalizedQuestion}</h4>
                      <p className="mt-2 text-sm text-white/45">Original: {item.draft.question}</p>
                      {item.moderation.improvedQuestion && item.moderation.improvedQuestion !== item.draft.question && (
                        <p className="mt-2 rounded-2xl border border-azure/20 bg-azure/10 p-3 text-sm text-white/70">AI improved: {item.moderation.improvedQuestion}</p>
                      )}
                      <p className="mt-2 text-white/60">{communityUi.correctAnswer}: {item.moderation.normalizedOptions[item.draft.correctIndex]}</p>
                      <p className="mt-2 text-sm text-white/50">{communityUi.recommendation}: {item.moderation.recommendation}</p>
                      <p className="mt-1 text-sm text-white/45">{communityUi.reasons}: {item.moderation.reasons.join(' | ')}</p>
                      {item.moderation.factCheck && (
                        <p className="mt-1 text-sm text-white/45">Fact check: {item.moderation.factCheck.status} · {item.moderation.factCheck.notes.join(' | ')}</p>
                      )}
                      {item.moderation.qualitySignals && (
                        <p className="mt-1 text-sm text-white/45">
                          Quality signals: duplicate {item.moderation.qualitySignals.duplicateRisk}, spam {item.moderation.qualitySignals.spamRisk}, unsafe {item.moderation.qualitySignals.unsafeRisk}, low quality {item.moderation.qualitySignals.lowQualityRisk}
                        </p>
                      )}
                      <p className="mt-2 rounded-2xl bg-white/[0.055] p-3 text-sm text-white/62">{item.moderation.explanation}</p>
                    </div>
                    <div className="flex min-w-48 flex-col gap-2">
                      <button className="premium-button focus-ring" onClick={() => approveSubmission(item.id)}>{communityUi.approve}</button>
                      <button className="ghost-button focus-ring" onClick={() => rejectSubmission(item.id)}>{communityUi.reject}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5">
            <h3 className="mb-4 text-2xl font-black">{communityUi.auditLog}</h3>
            <div className="grid max-h-80 gap-3 overflow-auto pr-1">
              {auditLogs.slice(0, 12).map(item => (
                <div key={item.id} className="rounded-2xl bg-black/18 p-3 text-sm">
                  <strong className="block text-gold">{item.action}</strong>
                  <span className="text-white/62">{item.details}</span>
                  <small className="mt-1 block text-white/35">{new Date(item.createdAt).toLocaleString()}</small>
                </div>
              ))}
              {auditLogs.length === 0 && <p className="text-white/55">No activity yet.</p>}
            </div>
          </div>
        </div>
      </div>
      <aside className="glass rounded-[30px] p-6">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-3xl font-black">{t.manageTitle}</h2><span className="text-gold"><SettingsIcon size={16} aria-hidden="true" /></span></div>
        <QuestionForm t={t} locale={locale} form={form} setForm={setForm} save={saveQuestion} reset={() => setForm(emptyQuestion())} />
        <div className="mt-7 border-t border-white/10 pt-6">
          <div className="mb-3 font-extrabold">{t.importExport}</div>
          <textarea className="form-input min-h-28" value={importText} onChange={event => setImportText(event.target.value)} aria-label={t.importExport} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2" onClick={importQuestions}>
              <ImportIcon size={16} />
              {t.importBtn}
            </button>
            <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2" onClick={exportQuestions}>
              <ExportIcon size={16} />
              {t.exportBtn}
            </button>
          </div>
        </div>
      </aside>
      <section className="glass rounded-[30px] p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div><h2 className="text-3xl font-black">{t.poolTitle}</h2><p className="mt-1 text-white/58">{fmt(t.poolCount, { total: questions.length, shown: filtered.length })}</p></div>
          <div className="flex flex-col gap-3 md:flex-row"><input className="form-input py-3 pl-4 pr-10 md:w-72" value={search} onChange={event => setSearch(event.target.value)} aria-label={t.searchPh} placeholder={t.searchPh} /><select className="form-input" value={category} onChange={event => setCategory(event.target.value)}><option value="הכול">{t.allOpt}</option>{categories.map(item => <option key={item} value={item}>{localizeCategory(locale, item)}</option>)}</select></div>
        </div>
        <div className="admin-scroll grid gap-3">
          {filtered.map(item => {
            const localized = localizeQuestion(item, locale);
            return (
              <article key={String(item.id)} className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 transition hover:border-gold/35 hover:bg-white/10">
                <div className="flex flex-col justify-between gap-4 xl:flex-row">
                  <div><div className="mb-2 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-gold/15 px-3 py-1 text-gold">{localized.category}</span><span className="rounded-full bg-azure/15 px-3 py-1 text-azure">{localized.difficulty}</span></div><h3 className="text-xl font-extrabold">{localized.question}</h3><p className="mt-2 text-white/58">{t.correctLbl}: {localized.answers[item.correctIndex]}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => { setForm(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <EditIcon size={16} />
                      {t.editBtn}
                    </button>
                    <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => setExtraQuestions(previous => [{ ...item, id: `copy-${Date.now()}`, question: `${item.question} (עותק)` }, ...previous])}>
                      <CopyIcon size={16} />
                      {t.dupBtn}
                    </button>
                    <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => setExtraQuestions(previous => previous.filter(question => question.id !== item.id))}>
                      <DeleteIcon size={16} />
                      {t.delBtn}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function QuestionForm({ t, locale, form, setForm, save, reset }: { t: Record<string, string>; locale: Locale; form: GameQuestion; setForm: (question: GameQuestion) => void; save: () => void; reset: () => void }) {
  const letters = OPTION_LETTERS[locale] || LETTERS;
  const difficulties = [
    { value: 'קל', label: t.diffEasy },
    { value: 'בינוני', label: t.diffMedium },
    { value: 'קשה', label: t.diffHard },
    { value: 'מומחה', label: t.diffExpert }
  ];
  return (
    <div className="space-y-4">
      <Field label={t.qLabel}><input className="form-input" value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} /></Field>
      {form.answers.map((answer, index) => <Field key={index} label={`${t.answerLbl} ${letters[index]}`}><input className="form-input" value={answer} onChange={event => { const answers = form.answers.map((item, answerIndex) => answerIndex === index ? event.target.value : item); setForm({ ...form, answers, options: answers }); }} /></Field>)}
      <div className="grid grid-cols-2 gap-3"><select className="form-input" value={form.correctIndex} onChange={event => setForm({ ...form, correctIndex: Number(event.target.value) })}>{letters.map((letter, index) => <option key={letter} value={index}>{t.correctOpt}: {letter}</option>)}</select><select className="form-input" value={form.difficulty} onChange={event => setForm({ ...form, difficulty: event.target.value })}>{difficulties.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3"><input className="form-input" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} /><input className="form-input" value={form.imageUrl || ''} onChange={event => setForm({ ...form, imageUrl: event.target.value })} aria-label={t.imageLink} placeholder={t.imageLink} /></div>
      <button className="premium-button focus-ring inline-flex w-full items-center justify-center gap-2" onClick={save}>
        <ConfirmIcon size={16} />
        {t.saveQuestion}
      </button>
      <button className="ghost-button focus-ring inline-flex w-full items-center justify-center gap-2" onClick={reset}>
        <CloseIcon size={16} />
        {t.clearForm}
      </button>
    </div>
  );
}

function mapAuthUser(user: User): PublicAuthUser {
  const metadata = user.user_metadata || {};
  const displayName = typeof metadata.full_name === 'string' && metadata.full_name.trim()
    ? metadata.full_name.trim()
    : typeof metadata.name === 'string' && metadata.name.trim()
      ? metadata.name.trim()
      : undefined;
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined;
  return {
    id: user.id,
    email: user.email || undefined,
    displayName,
    avatarUrl,
    createdAt: user.created_at
  };
}

