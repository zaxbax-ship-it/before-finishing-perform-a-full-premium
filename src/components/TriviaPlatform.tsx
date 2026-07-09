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
  type CommunityDraft,
  type CommunitySubmission,
  createAudit,
  emptyCommunityDraft,
  runLocalModeration,
  submissionToQuestion
} from '@/lib/community';
import { ensureLocaleResources, localizeCategory, localizeQuestion } from '@/lib/localization';
import { revealSection } from '@/lib/ui/revealSection';
import { getMultiplayerCopy } from '@/lib/multiplayer/localization';
import { API_QUESTION_EXCLUDE_MAX, CLIENT_SEEN_QUESTION_LIMIT } from '@/lib/services/questionSampling';
import { playAudioEvent, setAudioEnabled } from '@/lib/audio';
import { applyPurchase, availablePot, extraLifeCost, guaranteedForRung, payoutFor, SOLO_INITIAL_LIVES } from '@/lib/gameplay/economy';
import { applyGameToLocalProgression, readLocalProgression } from '@/lib/progression/local';
import type { PlayerProgressionState } from '@/lib/progression/types';
import type { LeaderboardEntry } from '@/lib/domain/models';
import { createAuthService } from '@/lib/auth/authService';
import { createBrowserSupabaseClient } from '@/lib/auth/supabaseBrowserClient';
import type { Locale, Question } from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import { Categories } from '@/components/trivia/screens/Categories';
import { Contact } from '@/components/trivia/screens/Contact';
import { Header } from '@/components/trivia/screens/Header';
import { Home } from '@/components/trivia/screens/Home';
import { Leaderboard } from '@/components/trivia/screens/Leaderboard';
import { Result } from '@/components/trivia/screens/Result';
import { Rules } from '@/components/trivia/screens/Rules';
import { SettingsPanel } from '@/components/trivia/screens/SettingsPanel';
import { fmt, money, validateNickname } from '@/components/trivia/format';
import { getAuthUi, getCommunityUi, getTriviaUi } from '@/components/trivia/i18n';
import { Field, Metric, Success } from '@/components/trivia/primitives';
import type { EndState, GameQuestion, LeaderboardStatus, Lifeline, PublicAuthUser, Screen, Settings, Stats } from '@/components/trivia/types';
import { LanguageMenu } from '@/components/trivia/chrome/LanguageMenu';
import { Particles } from '@/components/trivia/chrome/Particles';
import { PublicAuthArea } from '@/components/trivia/chrome/PublicAuthArea';
import { GameExitModal } from '@/components/trivia/modals/GameExitModal';
import { LifeOfferModal } from '@/components/trivia/modals/LifeOfferModal';
import { ProgressionToasts, type ProgressionToast } from '@/components/trivia/ProgressionToasts';
import { ACHIEVEMENT_KEYS } from '@/components/trivia/i18n';
import { PaidModal } from '@/components/trivia/modals/PaidModal';
import { Game } from '@/components/trivia/screens/Game';
import { PremiumProfile } from '@/components/trivia/screens/PremiumProfile';
import { LANGUAGE_OPTIONS, LETTERS, MONEY, OPTION_LETTERS, priceFor, SAFE_STEPS, SOLO_TIMER_SECONDS } from '@/components/trivia/constants';

const AUTO_ADVANCE_MS = 2200;
const STATS_KEY = 'premium-trivia-stats-v3';
const SETTINGS_KEY = 'premium-trivia-settings-v3';
const EXTRA_KEY = 'premium-trivia-extra-questions-v3';
const SEEN_QUESTIONS_KEY = 'premium-trivia-seen-question-ids-v1';
const COMMUNITY_KEY = 'premium-trivia-community-submissions-v1';
const AUDIT_KEY = 'premium-trivia-audit-log-v1';
const NICKNAME_KEY = 'premium-trivia-public-nickname-v1';
const LOCALE_KEY = 'premium-trivia-locale-v1';
const SUPPORTED_LOCALES: Locale[] = ['he', 'en', 'ar', 'ru', 'am'];
const SCREEN_MEMORY_KEY = 'premium-trivia-screen-v1';
// Screens that can be restored after back/forward navigation. Live-state
// screens (game, result) cannot be resurrected after a reload.
const RESTORABLE_SCREENS: Screen[] = ['home', 'categories', 'rules', 'leaderboard', 'profile', 'settings', 'submit', 'contact', 'multiplayer'];
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
  const [lifelineUses, setLifelineUses] = useState<Record<Lifeline, number>>({ fifty: 0, swap: 0, phone: 0, audience: 0 });
  const [advice, setAdvice] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingPaid, setPendingPaid] = useState<{ type: Lifeline; price: number } | null>(null);
  const [exitPrompt, setExitPrompt] = useState(false);
  const screenSectionRef = useRef<HTMLDivElement | null>(null);
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
  const [communityForm, setCommunityForm] = useState<CommunityDraft>(() => emptyCommunityDraft('he'));
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
  const advancingRef = useRef(false);

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
  const nextPrize = MONEY[round] || MONEY[MONEY.length - 1];
  const guaranteedPrize = guaranteedForRung(MONEY, round);
  const progress = Math.round(((round + 1) / 15) * 100);
  const timerUrgency = timer <= 8 ? 'danger' : timer <= 15 ? 'warn' : '';

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
      setScreen('multiplayer');
    } else {
      // Browser back/forward (e.g. returning from /login) restores the screen
      // the user actually left instead of resetting to home. Runs before the
      // screen-memory effect below writes its first value.
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navigationEntry?.type === 'back_forward') {
        try {
          const storedScreen = sessionStorage.getItem(SCREEN_MEMORY_KEY) as Screen | null;
          if (storedScreen && RESTORABLE_SCREENS.includes(storedScreen)) setScreen(storedScreen);
        } catch { /* sessionStorage unavailable */ }
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

  // The audio engine follows the sound setting; components then emit
  // semantic events without threading the flag around.
  useEffect(() => {
    setAudioEnabled(settings.sound);
  }, [settings.sound]);

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
  // engines get the correct language + direction (LTR for en/ru/am, RTL for
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

  useEffect(() => {
    setCommunityForm(previous => ({ ...previous, language: locale }));
  }, [locale]);

  // One reusable reveal for every dynamically opened section: scroll its
  // heading under the fixed bar and move focus there (see revealSection).
  useEffect(() => {
    revealSection(screenSectionRef.current);
  }, [screen, questionIndex]);

  useEffect(() => {
    if (screen !== 'game' || selected !== null || lifeOffer !== null) return;
    if (timer <= 0) {
      loseChance('timeout');
      return;
    }
    const id = window.setTimeout(() => {
      setTimer(value => value - 1);
      if (timer <= 6) playAudioEvent('timer.tick');
    }, 1000);
    return () => window.clearTimeout(id);
  }, [screen, selected, settings.sound, timer, lifeOffer]);

  useEffect(() => {
    if (screen !== 'game') return;
    const id = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  useEffect(() => () => clearAdvanceTimer(), []);

  // Keyboard shortcut: Enter advances to the next question after answering.
  useEffect(() => {
    if (screen !== 'game' || selected === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      advanceAfterAnswer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, selected]);

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
    setAuthUser(null);
    playAudioEvent('ui.tap');
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

  function open(next: Screen) {
    // The admin dashboard is only reachable through the protected /admin route;
    // the public app never navigates to it (server-side guards protect the data).
    if (next === 'admin' && initialScreen !== 'admin') return;
    clearAdvanceTimer();
    setScreen(next);
    playAudioEvent('ui.tap');
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
    if (available.length < 4) return;
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
    setLifelineUses({ fifty: 0, swap: 0, phone: 0, audience: 0 });
    setAdvice('');
    setNotice('');
    setElapsed(0);
    setScreen('game');
    playAudioEvent('game.start');
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
      const pool = shuffle(playableQuestions.filter(question => !usedIds.has(question.id)));
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
  }

  /** Correct answer: secure the rung and climb. The only path that raises the pot. */
  function climbLadder() {
    clearAdvanceTimer();
    if (round >= 14) {
      finishWithReason('win');
      return;
    }
    if (SAFE_STEPS.includes(round)) playAudioEvent('prize.milestone');
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

  function advanceAfterAnswer() {
    if (selected === null || advancingRef.current) return;
    advancingRef.current = true;
    clearAdvanceTimer();
    completeAnsweredQuestion(selected);
  }

  function chooseAnswer(index: number) {
    if (!current || selected !== null) return;
    setSelected(index);
    const correct = index === current.correctIndex;
    playAudioEvent(correct ? 'answer.correct' : 'answer.wrong');
    // No auto-advance after answering: the player reviews the explanation and
    // chooses when to continue via the Next button (or keyboard). The timeout
    // path below still expires unanswered questions automatically.
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
    setEndState(state);
    setFinalPrize(prize);
    setScreen('result');
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
  }

  function triggerLifeline(type: Lifeline) {
    if (!current) return;
    const uses = lifelineUses[type];
    const price = priceFor(type, currentPrize);
    if (uses > 0 && price > 0) {
      setPendingPaid({ type, price });
      return;
    }
    applyLifeline(type, 0);
  }

  function applyLifeline(type: Lifeline, price: number) {
    if (!current) return;
    setPendingPaid(null);
    setLifelineUses(previous => ({ ...previous, [type]: previous[type] + 1 }));
    playAudioEvent('lifeline.used');
    if (type === 'fifty') {
      setHiddenAnswers(order.filter(index => index !== current.correctIndex).slice(0, 2));
      setAdvice(t.fiftyAdvice);
    }
    if (type === 'swap') {
      const usedIds = new Set(gameSet.map(item => item.id));
      const seenSet = new Set(seenQuestionIds);
      const replacements = shuffle(playableQuestions.filter(question => question.category === gameSet[questionIndex].category && !usedIds.has(question.id)));
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
    if (price > 0) {
      setDeductions(value => applyPurchase(value, price));
      setNotice(fmt(t.paidDeducted, { amount: money(price) }));
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
    try {
      const response = await fetch('/api/community/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: communityForm })
      });
      const data = await response.json();
      if (response.ok && data?.ok && data.submission) {
        const submission = data.submission as CommunitySubmission;
        setCommunitySubmissions(previous => [submission, ...previous.filter(item => item.id !== submission.id)]);
        if (data.auditLog) setAuditLogs(previous => [data.auditLog, ...previous].slice(0, 80));
        if (submission.moderation.status === 'auto_approved') {
          const question = submission.question || submissionToQuestion(submission);
          setExtraQuestions(previous => [normalize(question), ...previous]);
          playAudioEvent('ui.success');
        } else if (submission.moderation.status === 'rejected') {
          playAudioEvent('ui.error');
        } else {
          playAudioEvent('ui.notice');
        }
        setCommunityProviderLabel(data.provider === 'database' ? 'Supabase + AI moderation ready' : 'Local JSON + mock AI ready');
        setCommunityMessage(communityT[submission.moderation.status === 'auto_approved' ? 'autoApproved' : submission.moderation.status === 'needs_review' ? 'needsReview' : 'rejected']);
        setCommunityForm(emptyCommunityDraft(locale, categories[0] || communityForm.category));
        return;
      }
    } catch {
      setCommunityProviderLabel('Local fallback active');
    }

    const moderation = runLocalModeration(communityForm, allQuestions, communitySubmissions);
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    let submission: CommunitySubmission = {
      id,
      createdAt: now,
      updatedAt: now,
      draft: {
        ...communityForm,
        question: communityForm.question.trim(),
        options: communityForm.options.map(option => option.trim()),
        explanation: communityForm.explanation.trim(),
        contributorEmail: communityForm.contributorEmail.trim().toLowerCase(),
        contributorName: communityForm.contributorName.trim()
      },
      moderation
    };

    if (moderation.status === 'auto_approved') {
      const question = submissionToQuestion(submission);
      submission = { ...submission, question };
      setExtraQuestions(previous => [normalize(question), ...previous]);
      playAudioEvent('ui.success');
    } else if (moderation.status === 'rejected') {
      playAudioEvent('ui.error');
    } else {
      playAudioEvent('ui.notice');
    }

    setCommunitySubmissions(previous => [submission, ...previous]);
    setAuditLogs(previous => [
      createAudit(
        'community_submission',
        submission.id,
        `${moderation.status} with score ${moderation.score}`,
        submission.draft.contributorEmail || submission.draft.contributorName || 'community-user'
      ),
      ...previous
    ].slice(0, 80));
    setCommunityMessage(communityT[moderation.status === 'auto_approved' ? 'autoApproved' : moderation.status === 'needs_review' ? 'needsReview' : 'rejected']);
    setCommunityForm(emptyCommunityDraft(locale, categories[0] || communityForm.category));
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
      {/* Single shared utility bar: language (physical left) and account (physical
          right) live in one flex row, so they can never overlap on any device. */}
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
      {screen === 'admin' && adminHeader}
      {screen !== 'admin' && <Header t={t} submitLabel={communityT.submitNav} multiplayerLabel={multiplayerCopy.nav} open={open} start={() => open('categories')} />}
      <div key={screen} ref={screenSectionRef} tabIndex={-1} className="screen-section">
      {screen === 'home' && <Home t={t} locale={locale} soloLabel={multiplayerCopy.solo} multiplayerLabel={multiplayerCopy.multiplayer} start={() => open('categories')} open={open} />}
      {screen === 'categories' && <Categories t={t} locale={locale} categories={categories} startGame={startGame} />}
      {screen === 'multiplayer' && <MultiplayerMode locale={locale} initialNickname={nickname} />}
      {screen === 'rules' && <Rules t={t} start={() => open('categories')} />}
      {screen === 'submit' && (
        <CommunitySubmit
          ui={communityT}
          locale={locale}
          categories={categories}
          form={communityForm}
          setForm={setCommunityForm}
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
          timerUrgency={timerUrgency}
          progress={progress}
          currentPrize={currentPrize}
          nextPrize={nextPrize}
          guaranteedPrize={guaranteedPrize}
          chances={chances}
          lifelineUses={lifelineUses}
          advice={advice}
          notice={notice}
          chooseAnswer={chooseAnswer}
          advanceAfterAnswer={advanceAfterAnswer}
          triggerLifeline={triggerLifeline}
          quit={() => finishWithReason('quit')}
          requestExit={() => setExitPrompt(true)}
        />
      )}
      {screen === 'result' && <Result t={t} authUi={authT} isAuthenticated={Boolean(authUser)} state={endState} correctCount={round} elapsed={elapsed} prize={finalPrize} start={() => open('categories')} home={() => open('home')} />}
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
          nickname={nickname}
          locale={locale}
          authUi={authT}
          setNickname={saveNickname}
          bestPrize={stats.bestPrize}
        />
      )}
      {screen === 'profile' && <PremiumProfile t={t} authUi={authT} user={authUser} nickname={nickname} stats={stats} progression={progression} />}
      {screen === 'settings' && <SettingsPanel t={t} settings={settings} setSettings={setSettings} reset={() => { localStorage.clear(); location.reload(); }} />}
      </div>
      {pendingPaid && <PaidModal t={t} pending={pendingPaid} pot={currentPrize} cancel={() => setPendingPaid(null)} confirm={() => applyLifeline(pendingPaid.type, pendingPaid.price)} />}
      {lifeOffer && <LifeOfferModal t={t} cost={lifeOffer.cost} accept={acceptLifeOffer} decline={declineLifeOffer} />}
      <ProgressionToasts toasts={progressionToasts} remove={id => setProgressionToasts(previous => previous.filter(toast => toast.id !== id))} />
      {exitPrompt && (
        <GameExitModal
          t={t}
          stay={() => setExitPrompt(false)}
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
  locale: Locale;
  categories: string[];
  form: CommunityDraft;
  setForm: (form: CommunityDraft | ((form: CommunityDraft) => CommunityDraft)) => void;
  submit: () => void;
  message: string;
}) {
  const { ui, locale, categories, form, setForm, submit, message } = props;
  const optionLetters = OPTION_LETTERS[locale] || LETTERS;
  const difficulties = ['קל', 'בינוני', 'קשה', 'מומחה'];
  const updateOption = (index: number, value: string) => {
    setForm(previous => ({
      ...previous,
      options: previous.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  return (
    <section className="mx-auto grid w-full max-w-[1180px] gap-6 px-5 pb-16 pt-8 lg:px-8">
      <div className="glass rounded-[34px] p-6 md:p-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="text-center">
            <p className="mx-auto mb-4 w-fit rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold">Community Studio</p>
            <h1 className="text-4xl font-black md:text-6xl">{ui.submitTitle}</h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-white/68">{ui.submitIntro}</p>
          </div>
          <div className="rounded-3xl border border-white/12 bg-white/[0.06] p-4 text-sm text-white/60">
            {ui.localMode}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label={ui.contributorName}>
            <input className="form-input" value={form.contributorName} onChange={event => setForm({ ...form, contributorName: event.target.value })} />
          </Field>
          <Field label={ui.contributorEmail}>
            <input className="form-input" type="email" value={form.contributorEmail} onChange={event => setForm({ ...form, contributorEmail: event.target.value })} />
          </Field>
          <Field label={ui.language}>
            <select className="form-input" value={form.language} onChange={event => setForm({ ...form, language: event.target.value as Locale })}>
              {LANGUAGE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.native}</option>)}
            </select>
          </Field>
          <Field label={ui.category}>
            <select className="form-input" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>
              {categories.map(category => <option key={category} value={category}>{localizeCategory(locale, category)}</option>)}
            </select>
          </Field>
          <Field label={ui.difficulty}>
            <select className="form-input" value={form.difficulty} onChange={event => setForm({ ...form, difficulty: event.target.value })}>
              {difficulties.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label={ui.correctAnswer}>
            <select className="form-input" value={form.correctIndex} onChange={event => setForm({ ...form, correctIndex: Number(event.target.value) })}>
              {optionLetters.map((letter, index) => <option key={letter} value={index}>{ui.answer} {letter}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <Field label={ui.question}>
            <textarea className="form-input min-h-28 text-xl font-bold" value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} />
          </Field>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {form.options.map((option, index) => (
            <Field key={index} label={`${ui.answer} ${optionLetters[index]}`}>
              <input className="form-input" value={option} onChange={event => updateOption(index, event.target.value)} />
            </Field>
          ))}
        </div>

        <div className="mt-5">
          <Field label={ui.explanation}>
            <textarea className="form-input min-h-28" value={form.explanation} onChange={event => setForm({ ...form, explanation: event.target.value })} />
          </Field>
        </div>

        <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center">
          <button className="premium-button focus-ring md:min-w-72" onClick={submit}>{ui.send}</button>
          {message && <Success text={message} />}
        </div>
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
          <div className="flex flex-col gap-3 sm:flex-row"><input className="form-input py-3 pl-4 pr-10 sm:w-72" value={search} onChange={event => setSearch(event.target.value)} aria-label={t.searchPh} placeholder={t.searchPh} /><select className="form-input" value={category} onChange={event => setCategory(event.target.value)}><option value="הכול">{t.allOpt}</option>{categories.map(item => <option key={item} value={item}>{localizeCategory(locale, item)}</option>)}</select></div>
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

