'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Globe, Heart, Home as HomeIcon, Mail, PenLine, Percent, Phone, RefreshCw, ScrollText, Settings as SettingsIcon, Sparkles, Star, Timer as TimerIcon, Trophy, Users } from 'lucide-react';
import { AdSlot, GameplayAdSlot } from '@/components/ads/AdSlot';
import { MultiplayerMode } from '@/components/multiplayer/MultiplayerMode';
import {
  type AuditLogEntry,
  type CommunityDraft,
  type CommunitySubmission,
  createAudit,
  emptyCommunityDraft,
  runLocalModeration,
  submissionToQuestion
} from '@/lib/community';
import { localizeCategory, localizeCategoryDescription, localizeQuestion } from '@/lib/localization';
import { revealSection } from '@/lib/ui/revealSection';
import { getMultiplayerCopy } from '@/lib/multiplayer/localization';
import type { LeaderboardEntry } from '@/lib/domain/models';
import { createAuthService } from '@/lib/auth/authService';
import { createBrowserSupabaseClient } from '@/lib/auth/supabaseBrowserClient';
import type { Locale, Question } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

type GameQuestion = Question & { answers: string[]; imageUrl?: string };
type Screen = 'home' | 'categories' | 'rules' | 'game' | 'result' | 'admin' | 'contact' | 'add' | 'profile' | 'settings' | 'submit' | 'leaderboard' | 'multiplayer';
type EndState = 'win' | 'quit' | 'timeout' | 'lost';
type Lifeline = 'fifty' | 'swap' | 'phone' | 'audience';
type LeaderboardStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'taken' | 'error';
type PublicAuthUser = {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt?: string;
};

type Settings = {
  sound: boolean;
  effects: boolean;
  timer: string;
};

type Stats = {
  games: number;
  bestPrize: number;
  totalMoney: number;
  correct: number;
  lifelines: number;
  achievements: string[];
};

const LETTERS = ['א', 'ב', 'ג', 'ד'];
const OPTION_LETTERS: Record<Locale, string[]> = {
  he: LETTERS,
  en: ['A', 'B', 'C', 'D'],
  ar: ['أ', 'ب', 'ج', 'د'],
  ru: ['А', 'Б', 'В', 'Г'],
  am: ['ሀ', 'ለ', 'ሐ', 'መ']
};

const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string; native: string }> = [
  { value: 'he', label: 'עברית', native: 'עברית' },
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ar', label: 'Arabic', native: 'العربية' },
  { value: 'ru', label: 'Russian', native: 'Русский' },
  { value: 'am', label: 'Amharic', native: 'አማርኛ' }
];

const MONEY = [1000, 2000, 5000, 10000, 20000, 40000, 80000, 150000, 250000, 400000, 550000, 700000, 850000, 1000000, 1000000];
const SAFE_STEPS = [4, 9, 14];
const AUTO_ADVANCE_MS = 2200;
const STATS_KEY = 'premium-trivia-stats-v3';
const SETTINGS_KEY = 'premium-trivia-settings-v3';
const EXTRA_KEY = 'premium-trivia-extra-questions-v3';
const COMMUNITY_KEY = 'premium-trivia-community-submissions-v1';
const AUDIT_KEY = 'premium-trivia-audit-log-v1';
const NICKNAME_KEY = 'premium-trivia-public-nickname-v1';
const RESERVED_NICKNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'owner',
  'support',
  'official',
  'system',
  'staff',
  'team',
  'google',
  'supabase',
  'root',
  'null',
  'undefined'
]);

const AUTH_UI: Record<Locale, Record<string, string>> = {
  he: {
    signIn: 'כניסה',
    createAccount: 'יצירת חשבון',
    account: 'חשבון',
    guest: 'אורח',
    profile: 'הפרופיל שלי',
    stats: 'הסטטיסטיקה שלי',
    achievements: 'הישגים',
    leaderboard: 'לוח שיאים',
    settings: 'הגדרות',
    logout: 'יציאה',
    nicknamePrompt: 'בחרו כינוי ציבורי לשמירת שיאים ומשחקים מרובי משתתפים.',
    nicknamePlaceholder: 'כינוי ציבורי',
    saveNickname: 'שמירת כינוי',
    googleSoon: 'כניסה עם Google תופעל בהמשך.',
    guestCtaTitle: 'שמרו את ההתקדמות שלכם',
    guestCtaBody: 'צרו חשבון חינמי כדי לשמור סטטיסטיקות, דירוגים והישגים.',
    privateEmail: 'אימייל פרטי',
    memberSince: 'חבר מאז',
    multiplayerWins: 'ניצחונות מרובי משתתפים',
    winRate: 'אחוז ניצחון',
    favoriteCategory: 'קטגוריה מועדפת',
    chooseNickname: 'בחרו כינוי',
    nicknameValid: 'הכינוי נראה טוב.',
    nicknameShort: 'הכינוי חייב לכלול לפחות 3 תווים.',
    nicknameLong: 'הכינוי יכול לכלול עד 20 תווים.',
    nicknameChars: 'אפשר להשתמש באותיות, מספרים, רווח, נקודה, קו תחתון או מקף.',
    nicknameReserved: 'הכינוי הזה שמור למערכת. נסו כינוי אחר.',
    notSignedIn: 'לא מחובר'
  },
  en: {
    signIn: 'Sign In',
    createAccount: 'Create Account',
    account: 'Account',
    guest: 'Guest',
    profile: 'My Profile',
    stats: 'My Statistics',
    achievements: 'My Achievements',
    leaderboard: 'Global Leaderboard',
    settings: 'Settings',
    logout: 'Logout',
    nicknamePrompt: 'Choose a public nickname for scores and multiplayer.',
    nicknamePlaceholder: 'Public nickname',
    saveNickname: 'Save nickname',
    googleSoon: 'Continue with Google will be enabled later.',
    guestCtaTitle: 'Save Your Progress',
    guestCtaBody: 'Create a free account to save statistics, rankings and achievements.',
    privateEmail: 'Private email',
    memberSince: 'Member since',
    multiplayerWins: 'Multiplayer wins',
    winRate: 'Win rate',
    favoriteCategory: 'Favorite category',
    chooseNickname: 'Choose nickname',
    nicknameValid: 'This nickname looks good.',
    nicknameShort: 'Nickname must be at least 3 characters.',
    nicknameLong: 'Nickname can be up to 20 characters.',
    nicknameChars: 'Use letters, numbers, spaces, dots, underscores or hyphens.',
    nicknameReserved: 'This nickname is reserved. Try another one.',
    notSignedIn: 'Not signed in'
  },
  ar: {
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    account: 'الحساب',
    guest: 'زائر',
    profile: 'ملفي',
    stats: 'إحصاءاتي',
    achievements: 'إنجازاتي',
    leaderboard: 'لوحة الصدارة',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
    nicknamePrompt: 'اختر اسمًا علنيًا للنتائج واللعب الجماعي.',
    nicknamePlaceholder: 'اسم علني',
    saveNickname: 'حفظ الاسم',
    googleSoon: 'تسجيل الدخول عبر Google سيتاح لاحقًا.',
    guestCtaTitle: 'احفظ تقدمك',
    guestCtaBody: 'أنشئ حسابًا مجانيًا لحفظ الإحصاءات والترتيب والإنجازات.',
    privateEmail: 'البريد الخاص',
    memberSince: 'عضو منذ',
    multiplayerWins: 'انتصارات جماعية',
    winRate: 'نسبة الفوز',
    favoriteCategory: 'الفئة المفضلة',
    chooseNickname: 'اختر اسمًا',
    nicknameValid: 'هذا الاسم مناسب.',
    nicknameShort: 'يجب أن يتكون الاسم من 3 أحرف على الأقل.',
    nicknameLong: 'يمكن أن يصل الاسم إلى 20 حرفًا.',
    nicknameChars: 'استخدم حروفًا أو أرقامًا أو مسافات أو نقاطًا أو شرطات.',
    nicknameReserved: 'هذا الاسم محجوز. جرّب اسمًا آخر.',
    notSignedIn: 'غير مسجل'
  },
  ru: {
    signIn: 'Войти',
    createAccount: 'Создать аккаунт',
    account: 'Аккаунт',
    guest: 'Гость',
    profile: 'Мой профиль',
    stats: 'Моя статистика',
    achievements: 'Мои достижения',
    leaderboard: 'Общий рейтинг',
    settings: 'Настройки',
    logout: 'Выйти',
    nicknamePrompt: 'Выберите публичный ник для рейтинга и мультиплеера.',
    nicknamePlaceholder: 'Публичный ник',
    saveNickname: 'Сохранить ник',
    googleSoon: 'Вход через Google будет доступен позже.',
    guestCtaTitle: 'Сохраните прогресс',
    guestCtaBody: 'Создайте бесплатный аккаунт, чтобы сохранять статистику, рейтинг и достижения.',
    privateEmail: 'Личный email',
    memberSince: 'Участник с',
    multiplayerWins: 'Победы в мультиплеере',
    winRate: 'Процент побед',
    favoriteCategory: 'Любимая категория',
    chooseNickname: 'Выберите ник',
    nicknameValid: 'Этот ник выглядит хорошо.',
    nicknameShort: 'Ник должен быть не короче 3 символов.',
    nicknameLong: 'Ник может быть до 20 символов.',
    nicknameChars: 'Используйте буквы, цифры, пробелы, точки, подчёркивания или дефисы.',
    nicknameReserved: 'Этот ник зарезервирован. Попробуйте другой.',
    notSignedIn: 'Не выполнен вход'
  },
  am: {
    signIn: 'ግባ',
    createAccount: 'መለያ ፍጠር',
    account: 'መለያ',
    guest: 'እንግዳ',
    profile: 'የእኔ መገለጫ',
    stats: 'የእኔ ስታቲስቲክስ',
    achievements: 'የእኔ ስኬቶች',
    leaderboard: 'የዓለም ደረጃ',
    settings: 'ቅንብሮች',
    logout: 'ውጣ',
    nicknamePrompt: 'ለውጤቶች እና ለብዙ ተጫዋቾች ጨዋታ የሚታይ ስም ይምረጡ።',
    nicknamePlaceholder: 'የሚታይ ስም',
    saveNickname: 'ስም አስቀምጥ',
    googleSoon: 'በGoogle መግባት በኋላ ይነቃል።',
    guestCtaTitle: 'እድገትዎን ያስቀምጡ',
    guestCtaBody: 'ስታቲስቲክስ፣ ደረጃ እና ስኬቶችን ለማስቀመጥ ነፃ መለያ ይፍጠሩ።',
    privateEmail: 'የግል ኢሜይል',
    memberSince: 'አባል ከ',
    multiplayerWins: 'የብዙ ተጫዋቾች ድሎች',
    winRate: 'የድል መጠን',
    favoriteCategory: 'ተወዳጅ ምድብ',
    chooseNickname: 'ስም ይምረጡ',
    nicknameValid: 'ይህ ስም ጥሩ ይመስላል።',
    nicknameShort: 'ስሙ ቢያንስ 3 ቁምፊዎች መሆን አለበት።',
    nicknameLong: 'ስሙ እስከ 20 ቁምፊዎች መሆን ይችላል።',
    nicknameChars: 'ፊደላት፣ ቁጥሮች፣ ክፍተቶች፣ ነጥቦች ወይም ሰረዞች ይጠቀሙ።',
    nicknameReserved: 'ይህ ስም ተይዟል። ሌላ ይሞክሩ።',
    notSignedIn: 'አልገቡም'
  }
};

const UI: Record<Locale, Record<string, string>> = {
  he: {
    rules: 'איך משחקים',
    admin: 'ניהול שאלות',
    start: 'התחלת משחק',
    headline: 'משחק השעשועון',
    subtitle: 'טריוויה עברית יוקרתית',
    pill: 'חוויית שעשועון פרימיום בעברית מלאה',
    intro: 'מסע טריוויה דרמטי עם 15 שאלות, שלוש הזדמנויות, קופה חיה, גלגלי הצלה אסטרטגיים וסולם זכייה נוצץ.',
    enter: 'התחלת משחק',
    manage: 'ניהול מאגר השאלות',
    live: 'שידור חי',
    choose: 'בחרו קטגוריה והתחילו משחק ממוקד',
    chooseText: 'כל נושא כולל מאגר עשיר ומאוזן של שאלות בעברית טבעית, עם אותו סולם זכייה ואותה חוויית אולפן דרמטית.',
    all: 'משחק מכל הנושאים',
    question: 'שאלה',
    currentPrize: 'זכייה נוכחית',
    lifelines: 'גלגלי הצלה',
    ladder: 'סולם זכייה',
    guaranteed: 'סכום מובטח',
    quit: 'לפרוש ולקחת כסף',
    free: 'חינם',
    playAgain: 'משחק נוסף',
    home: 'בית',
    contact: 'צור קשר',
    add: 'הוספת שאלה',
    profile: 'האזור האישי שלי',
    settings: 'הגדרות'
    ,available: 'שאלות זמינות'
    ,of: 'מתוך', currentPot: 'קופה נוכחית', seconds: 'שניות', chancesLabel: 'הזדמנויות', reuseHint: 'שימוש ראשון חינם. שימוש חוזר מנכה כסף מהקופה הנוכחית.', fifty: '50:50', swap: 'החלפה', phone: 'חבר', audience: 'קהל'
  },
  en: {
    rules: 'How to Play',
    admin: 'Question Admin',
    start: 'Start Game',
    headline: 'The Quiz Show',
    subtitle: 'Premium Hebrew Trivia',
    pill: 'A full premium Hebrew quiz show experience',
    intro: 'A dramatic 15-question trivia journey with three chances, a live bank, strategic lifelines and a glittering prize ladder.',
    enter: 'Start Game',
    manage: 'Manage Questions',
    live: 'Live Broadcast',
    choose: 'Choose a Category and Start a Focused Game',
    chooseText: 'Every topic includes a rich balanced question bank with the same prize ladder and studio feeling.',
    all: 'All Categories',
    question: 'Question',
    currentPrize: 'Current Prize',
    lifelines: 'Lifelines',
    ladder: 'Prize Ladder',
    guaranteed: 'Guaranteed Prize',
    quit: 'Quit and Take the Money',
    free: 'Free',
    playAgain: 'Play Again',
    home: 'Home',
    contact: 'Contact',
    add: 'Add Question',
    profile: 'My Area',
    settings: 'Settings'
    ,available: 'available questions'
    ,of: 'of', currentPot: 'Current Bank', seconds: 'seconds', chancesLabel: 'Chances', reuseHint: 'First use is free. Reuse deducts money from the current bank.', fifty: '50:50', swap: 'Switch', phone: 'Friend', audience: 'Audience'
  },
  ar: {
    rules: 'طريقة اللعب',
    admin: 'إدارة الأسئلة',
    start: 'ابدأ اللعبة',
    headline: 'برنامج المسابقات',
    subtitle: 'تريفيا عبرية فاخرة',
    pill: 'تجربة مسابقات عبرية فاخرة كاملة',
    intro: 'رحلة تريفيا درامية من 15 سؤالا مع ثلاث فرص، رصيد حي، وسائل مساعدة استراتيجية وسلم جوائز لامع.',
    enter: 'ابدأ اللعبة',
    manage: 'إدارة بنك الأسئلة',
    live: 'بث مباشر',
    choose: 'اختر فئة وابدأ لعبة مركزة',
    chooseText: 'كل موضوع يحتوي على بنك أسئلة غني ومتوازن مع سلم الجوائز نفسه وأجواء الاستوديو الدرامية.',
    all: 'كل الفئات',
    question: 'سؤال',
    currentPrize: 'الجائزة الحالية',
    lifelines: 'وسائل المساعدة',
    ladder: 'سلم الجوائز',
    guaranteed: 'المبلغ المضمون',
    quit: 'انسحب وخذ المال',
    free: 'مجاني',
    playAgain: 'لعبة أخرى',
    home: 'الرئيسية',
    contact: 'تواصل',
    add: 'إضافة سؤال',
    profile: 'منطقتي الشخصية',
    settings: 'الإعدادات'
    ,available: 'أسئلة متاحة'
    ,of: 'من', currentPot: 'الرصيد الحالي', seconds: 'ثوان', chancesLabel: 'الفرص', reuseHint: 'الاستخدام الأول مجاني. الاستخدام المتكرر يخصم من الرصيد الحالي.', fifty: '50:50', swap: 'تبديل', phone: 'صديق', audience: 'الجمهور'
  },
  ru: {
    rules: 'Правила',
    admin: 'Управление вопросами',
    start: 'Начать игру',
    headline: 'Викторина',
    subtitle: 'Премиальная ивритская викторина',
    pill: 'Полный премиальный формат телевизионной викторины на иврите',
    intro: 'Драматическая игра из 15 вопросов, три попытки, живой банк, стратегические подсказки и сияющая призовая лестница.',
    enter: 'Начать игру',
    manage: 'Управление вопросами',
    live: 'Прямой эфир',
    choose: 'Выберите категорию и начните игру',
    chooseText: 'В каждой теме есть богатый сбалансированный банк вопросов, призовая лестница и атмосфера студии.',
    all: 'Все категории',
    question: 'Вопрос',
    currentPrize: 'Текущий приз',
    lifelines: 'Подсказки',
    ladder: 'Призовая лестница',
    guaranteed: 'Гарантированная сумма',
    quit: 'Забрать деньги',
    free: 'Бесплатно',
    playAgain: 'Еще игра',
    home: 'Домой',
    contact: 'Контакт',
    add: 'Добавить вопрос',
    profile: 'Мой кабинет',
    settings: 'Настройки'
    ,available: 'доступных вопросов'
    ,of: 'из', currentPot: 'Текущий банк', seconds: 'секунд', chancesLabel: 'Попытки', reuseHint: 'Первое использование бесплатно. Повторное списывает деньги из текущего банка.', fifty: '50:50', swap: 'Замена', phone: 'Друг', audience: 'Зал'
  },
  am: {
    rules: 'እንዴት እንደሚጫወቱ',
    admin: 'የጥያቄዎች አስተዳደር',
    start: 'ጨዋታ ጀምር',
    headline: 'የእውቀት ጨዋታ',
    subtitle: 'ፕሪሚየም የዕብራይስጥ ትሪቪያ',
    pill: 'ሙሉ የፕሪሚየም የትሪቪያ ስቱዲዮ ልምድ',
    intro: '15 ጥያቄዎች፣ ሶስት እድሎች፣ ቀጥታ ሽልማት፣ የእርዳታ መንገዶች እና የሚያበራ የሽልማት መደብ።',
    enter: 'ጨዋታ ጀምር',
    manage: 'የጥያቄዎች ባንክ አስተዳድር',
    live: 'ቀጥታ ስርጭት',
    choose: 'ምድብ ይምረጡና ጨዋታ ይጀምሩ',
    chooseText: 'እያንዳንዱ ርዕስ የተመጣጠነ የጥያቄዎች ባንክ፣ የሽልማት መደብ እና የስቱዲዮ ስሜት አለው።',
    all: 'ሁሉም ምድቦች',
    question: 'ጥያቄ',
    currentPrize: 'አሁን ያለ ሽልማት',
    lifelines: 'እርዳታዎች',
    ladder: 'የሽልማት መደብ',
    guaranteed: 'የተረጋገጠ ሽልማት',
    quit: 'ወጥተው ገንዘቡን ይውሰዱ',
    free: 'ነፃ',
    playAgain: 'ሌላ ጨዋታ',
    home: 'መነሻ',
    contact: 'አግኙን',
    add: 'ጥያቄ ጨምር',
    profile: 'የግል ክፍል',
    settings: 'ቅንብሮች'
    ,available: 'ያሉ ጥያቄዎች'
    ,of: 'ከ', currentPot: 'አሁን ያለ ሽልማት', seconds: 'ሰከንዶች', chancesLabel: 'እድሎች', reuseHint: 'መጀመሪያው ነፃ ነው። ዳግም መጠቀም ከሽልማቱ ይቀንሳል።', fifty: '50:50', swap: 'ቀይር', phone: 'ጓደኛ', audience: 'ታዳሚ'
  }
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'ידע כללי': 'תרבות, שפה ועובדות מפתיעות',
  'אנגלית - בחינה עצמית': 'אוצר מילים שימושי באנגלית',
  'טכנולוגיה': 'דיגיטל, תוכנה וחדשנות',
  'מדע': 'טבע, חלל, כימיה ופיזיקה',
  'היסטוריה': 'אירועים, תקופות ודמויות',
  'גאוגרפיה': 'מדינות, ערים, נהרות והרים',
  'תחבורה': 'כבישים, רכבות, תעופה וים',
  'רפואה': 'גוף האדם, בריאות ומושגי יסוד',
  'ספורט': 'רגעי שיא, חוקים ואלופים',
  'פוליטיקה': 'מנהיגות, ממשל ודמוקרטיה',
  'רכילות': 'סלבס, תרבות פופ ושיחות היום',
  'קולנוע': 'סרטים, במאים, שחקנים וזיכרונות מסך',
  'טיקטוק': 'טרנדים, יוצרים ושפת הרשת'
};

const UI_EXT: Record<Locale, Record<string, string>> = {
  he: {
    rulesTitle: 'תקנון המשחק',
    rule1: 'לכל משחק יש 15 שאלות וסולם זכייה עולה.',
    rule2: 'לשחקן יש 3 הזדמנויות. תשובה שגויה או סיום זמן מורידים הזדמנות אחת.',
    rule3: 'כאשר ההזדמנויות נגמרות המשחק מסתיים לפי התחנה הבטוחה והקופה הנוכחית.',
    rule4: 'כל גלגל הצלה חינם בפעם הראשונה. שימוש חוזר אפשרי בתשלום מהקופה.',
    rule5: 'אפשר לפרוש בכל רגע ולקחת את הזכייה הנוכחית.',
    readyStart: 'אני מוכן להתחיל',
    catPill: 'בחירת נושא לפני העלייה לשידור',
    homeQuestions: 'שאלות',
    homePrize: 'פרס',
    timeoutNotice: 'הזמן אזל. ירדה הזדמנות אחת ועוברים לשאלה הבאה.',
    wrongNotice: 'תשובה שגויה. ירדה הזדמנות אחת ועוברים לשאלה הבאה.',
    fiftyAdvice: 'נותרו שתי תשובות חזקות יותר על המסך.',
    swapAdvice: 'השאלה הוחלפה בשאלה חדשה מאותה קטגוריה.',
    phoneAdvice: 'החבר מעריך שהתשובה היא {answer}.',
    audienceAdvice: 'הקהל נוטה לבחור בתשובה {letter} ברוב ברור.',
    paidDeducted: 'נוכו {amount} מהקופה הנוכחית עבור שימוש חוזר.',
    winTitle: 'זכייה מושלמת',
    quitTitle: 'פרישה חכמה',
    timeoutTitle: 'הזמן אזל',
    lostTitle: 'נגמרו ההזדמנויות',
    resultSummary: 'סיימת עם {correct} תשובות נכונות, זמן משחק של {time} וזכייה של {prize}.',
    accuracy: 'דיוק',
    timeLabel: 'זמן',
    shareBtn: 'שיתוף תוצאה',
    shareText: 'זכיתי ב-{prize}',
    paidTitle: 'שימוש חוזר בגלגל הצלה',
    paidBody: 'האם להשתמש שוב ב{label} בתמורה ל{price}?',
    paidPotInfo: 'בקופה הנוכחית יש {pot}. הסכום ינוכה מיד אחרי האישור.',
    confirmPay: 'אישור תשלום',
    cancelBtn: 'ביטול',
    fullName: 'שם מלא',
    email: 'אימייל',
    message: 'הודעה',
    sendMsg: 'שליחת הודעה',
    contactSuccess: 'ההודעה התקבלה. נחזור אליך בהקדם.',
    addSaved: 'השאלה נשמרה מקומית ותוכל להשתלב במאגר.',
    gamesPlayed: 'משחקים ששוחקו',
    bestWin: 'שיא זכייה',
    correctTotal: 'תשובות נכונות',
    moneyTotal: 'סך כסף שנצבר',
    lifelinesUsed: 'שימוש בגלגלי הצלה',
    achievementsLbl: 'הישגים',
    achStudio: 'כניסה לאולפן',
    achMillion: 'מיליון דולר',
    achSenior: 'שחקן בכיר',
    achDone: 'משחק הושלם',
    soundLbl: 'סאונד',
    effectsLbl: 'אפקטים חזותיים',
    timerLbl: 'עוצמת טיימר',
    timerCalm: 'רגועה',
    timerDramatic: 'דרמטית',
    timerIntense: 'אינטנסיבית',
    resetData: 'איפוס נתונים מקומיים',
    manageTitle: 'ניהול שאלות',
    poolTitle: 'מאגר השאלות',
    poolCount: '{total} שאלות במערכת · {shown} מוצגות כרגע',
    searchPh: 'חיפוש',
    importExport: 'ייבוא וייצוא',
    importBtn: 'ייבוא',
    exportBtn: 'ייצוא',
    importFail: 'הייבוא נכשל. בדקו שהטקסט הוא JSON תקין.',
    editBtn: 'עריכה',
    dupBtn: 'שכפול',
    delBtn: 'מחיקה',
    correctLbl: 'תשובה נכונה',
    saveQuestion: 'שמירת שאלה',
    clearForm: 'ניקוי טופס',
    qLabel: 'שאלה',
    answerLbl: 'תשובה',
    correctOpt: 'נכונה',
    imageLink: 'קישור תמונה',
    allOpt: 'הכול',
    diffEasy: 'קל',
    diffMedium: 'בינוני',
    diffHard: 'קשה',
    diffExpert: 'מומחה',
    catNav: 'קטגוריות',
    homeActionsLabel: 'ניווט ראשי',
    lbNav: 'לוח שיאים',
    lbTitle: 'לוח השיאים',
    lbSubtitle: 'השחקנים המובילים בפלטפורמה',
    lbRank: 'מקום',
    lbPlayer: 'שחקן',
    lbBest: 'שיא זכייה',
    lbEmpty: 'עדיין אין שיאים. היו הראשונים לקבוע תוצאה!',
    lbLoading: 'טוען את לוח השיאים…',
    lbError: 'לא הצלחנו לטעון את לוח השיאים כרגע.',
    lbNickname: 'כינוי ציבורי',
    lbNicknameHint: 'בחרו כינוי ייחודי (3–20 תווים) שיוצג בלוח השיאים. בלי כינוי — התוצאות לא ישותפו.',
    lbSave: 'שמירת כינוי',
    lbSaved: 'הכינוי נשמר. תוצאות המשחקים הבאים ישותפו ללוח.',
    lbTaken: 'הכינוי הזה כבר תפוס. נסו כינוי אחר.',
    lbYourBest: 'השיא האישי שלך',
    exitTitle: 'לצאת מהמשחק?',
    exitBody: 'ההתקדמות והקופה הנוכחית לא יישמרו אם תצאו עכשיו.',
    exitStay: 'להמשיך לשחק',
    exitLeave: 'יציאה לדף הבית',
    exitHomeAria: 'חזרה לדף הבית'
  },
  en: {
    rulesTitle: 'Game Rules',
    rule1: 'Every game has 15 questions and a rising prize ladder.',
    rule2: 'You have 3 chances. A wrong answer or running out of time costs one chance.',
    rule3: 'When you run out of chances, the game ends at the safe milestone and the current bank.',
    rule4: 'Every lifeline is free the first time. Using it again costs money from the bank.',
    rule5: 'You can walk away at any moment and take your current winnings.',
    readyStart: 'I am ready to start',
    catPill: 'Pick a topic before going on air',
    homeQuestions: 'Questions',
    homePrize: 'Prize',
    timeoutNotice: 'Time is up. You lost one chance and we move to the next question.',
    wrongNotice: 'Wrong answer. You lost one chance and we move to the next question.',
    fiftyAdvice: 'Two stronger answers remain on the screen.',
    swapAdvice: 'The question was replaced with a new one from the same category.',
    phoneAdvice: 'Your friend believes the answer is {answer}.',
    audienceAdvice: 'The audience clearly leans toward answer {letter}.',
    paidDeducted: '{amount} was deducted from the current bank for repeated use.',
    winTitle: 'A Perfect Win',
    quitTitle: 'A Smart Walk Away',
    timeoutTitle: 'Time Ran Out',
    lostTitle: 'Out of Chances',
    resultSummary: 'You finished with {correct} correct answers, a game time of {time} and winnings of {prize}.',
    accuracy: 'Accuracy',
    timeLabel: 'Time',
    shareBtn: 'Share Result',
    shareText: 'I won {prize}',
    paidTitle: 'Use a Lifeline Again',
    paidBody: 'Use {label} again in exchange for {price}?',
    paidPotInfo: 'The current bank holds {pot}. The amount is deducted right after you confirm.',
    confirmPay: 'Confirm Payment',
    cancelBtn: 'Cancel',
    fullName: 'Full Name',
    email: 'Email',
    message: 'Message',
    sendMsg: 'Send Message',
    contactSuccess: 'Your message was received. We will get back to you soon.',
    addSaved: 'The question was saved locally and can join the question bank.',
    gamesPlayed: 'Games Played',
    bestWin: 'Best Win',
    correctTotal: 'Correct Answers',
    moneyTotal: 'Total Money Earned',
    lifelinesUsed: 'Lifelines Used',
    achievementsLbl: 'Achievements',
    achStudio: 'Entered the Studio',
    achMillion: 'One Million Dollars',
    achSenior: 'Top Player',
    achDone: 'Game Completed',
    soundLbl: 'Sound',
    effectsLbl: 'Visual Effects',
    timerLbl: 'Timer Intensity',
    timerCalm: 'Calm',
    timerDramatic: 'Dramatic',
    timerIntense: 'Intense',
    resetData: 'Reset Local Data',
    manageTitle: 'Question Management',
    poolTitle: 'Question Bank',
    poolCount: '{total} questions in the system · {shown} currently shown',
    searchPh: 'Search',
    importExport: 'Import and Export',
    importBtn: 'Import',
    exportBtn: 'Export',
    importFail: 'Import failed. Make sure the text is valid JSON.',
    editBtn: 'Edit',
    dupBtn: 'Duplicate',
    delBtn: 'Delete',
    correctLbl: 'Correct answer',
    saveQuestion: 'Save Question',
    clearForm: 'Clear Form',
    qLabel: 'Question',
    answerLbl: 'Answer',
    correctOpt: 'Correct',
    imageLink: 'Image link',
    allOpt: 'All',
    diffEasy: 'Easy',
    diffMedium: 'Medium',
    diffHard: 'Hard',
    diffExpert: 'Expert',
    catNav: 'Categories',
    homeActionsLabel: 'Main navigation',
    lbNav: 'Leaderboard',
    lbTitle: 'Leaderboard',
    lbSubtitle: 'The top players on the platform',
    lbRank: 'Rank',
    lbPlayer: 'Player',
    lbBest: 'Best Win',
    lbEmpty: 'No records yet. Be the first to set a score!',
    lbLoading: 'Loading the leaderboard…',
    lbError: 'We could not load the leaderboard right now.',
    lbNickname: 'Public nickname',
    lbNicknameHint: 'Pick a unique nickname (3–20 characters) shown on the leaderboard. Without a nickname your results are not shared.',
    lbSave: 'Save nickname',
    lbSaved: 'Nickname saved. Your next game results will be shared to the board.',
    lbTaken: 'That nickname is already taken. Try another one.',
    lbYourBest: 'Your personal best',
    exitTitle: 'Leave the game?',
    exitBody: 'Your progress and current bank will not be saved if you leave now.',
    exitStay: 'Keep playing',
    exitLeave: 'Exit to home',
    exitHomeAria: 'Back to home'
  },
  ar: {
    rulesTitle: 'قواعد اللعبة',
    rule1: 'كل لعبة تضم 15 سؤالا وسلم جوائز متصاعدا.',
    rule2: 'لديك ثلاث فرص. الإجابة الخاطئة أو انتهاء الوقت يكلفك فرصة واحدة.',
    rule3: 'عندما تنتهي الفرص تنتهي اللعبة حسب المحطة الآمنة والرصيد الحالي.',
    rule4: 'كل وسيلة مساعدة مجانية في المرة الأولى. الاستخدام المتكرر يكلف مالا من الرصيد.',
    rule5: 'يمكنك الانسحاب في أي لحظة وأخذ أرباحك الحالية.',
    readyStart: 'أنا مستعد للبدء',
    catPill: 'اختر موضوعا قبل دخول البث',
    homeQuestions: 'أسئلة',
    homePrize: 'جائزة',
    timeoutNotice: 'انتهى الوقت. خسرت فرصة واحدة وننتقل إلى السؤال التالي.',
    wrongNotice: 'إجابة خاطئة. خسرت فرصة واحدة وننتقل إلى السؤال التالي.',
    fiftyAdvice: 'بقيت إجابتان أقوى على الشاشة.',
    swapAdvice: 'تم استبدال السؤال بسؤال جديد من الفئة نفسها.',
    phoneAdvice: 'صديقك يرجح أن الإجابة هي {answer}.',
    audienceAdvice: 'الجمهور يميل بوضوح إلى الإجابة {letter}.',
    paidDeducted: 'تم خصم {amount} من الرصيد الحالي مقابل الاستخدام المتكرر.',
    winTitle: 'فوز مثالي',
    quitTitle: 'انسحاب ذكي',
    timeoutTitle: 'انتهى الوقت',
    lostTitle: 'نفدت الفرص',
    resultSummary: 'أنهيت اللعبة بعدد {correct} إجابات صحيحة، وزمن لعب {time}، وأرباح قدرها {prize}.',
    accuracy: 'الدقة',
    timeLabel: 'الوقت',
    shareBtn: 'مشاركة النتيجة',
    shareText: 'ربحت {prize}',
    paidTitle: 'استخدام وسيلة المساعدة مجددا',
    paidBody: 'هل تريد استخدام {label} مجددا مقابل {price}؟',
    paidPotInfo: 'الرصيد الحالي {pot}. يخصم المبلغ فور التأكيد.',
    confirmPay: 'تأكيد الدفع',
    cancelBtn: 'إلغاء',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    message: 'الرسالة',
    sendMsg: 'إرسال الرسالة',
    contactSuccess: 'تم استلام رسالتك. سنعود إليك قريبا.',
    addSaved: 'تم حفظ السؤال محليا ويمكن ضمه إلى بنك الأسئلة.',
    gamesPlayed: 'ألعاب لعبتها',
    bestWin: 'أعلى ربح',
    correctTotal: 'إجابات صحيحة',
    moneyTotal: 'إجمالي المال المتراكم',
    lifelinesUsed: 'وسائل مساعدة مستخدمة',
    achievementsLbl: 'إنجازات',
    achStudio: 'دخول الاستوديو',
    achMillion: 'مليون دولار',
    achSenior: 'لاعب كبير',
    achDone: 'اكتملت اللعبة',
    soundLbl: 'الصوت',
    effectsLbl: 'مؤثرات بصرية',
    timerLbl: 'شدة المؤقت',
    timerCalm: 'هادئة',
    timerDramatic: 'درامية',
    timerIntense: 'مكثفة',
    resetData: 'إعادة تعيين البيانات المحلية',
    manageTitle: 'إدارة الأسئلة',
    poolTitle: 'بنك الأسئلة',
    poolCount: '{total} سؤالا في النظام · {shown} معروضة الآن',
    searchPh: 'بحث',
    importExport: 'استيراد وتصدير',
    importBtn: 'استيراد',
    exportBtn: 'تصدير',
    importFail: 'فشل الاستيراد. تأكد أن النص JSON صالح.',
    editBtn: 'تعديل',
    dupBtn: 'نسخ',
    delBtn: 'حذف',
    correctLbl: 'الإجابة الصحيحة',
    saveQuestion: 'حفظ السؤال',
    clearForm: 'مسح النموذج',
    qLabel: 'السؤال',
    answerLbl: 'إجابة',
    correctOpt: 'الصحيحة',
    imageLink: 'رابط صورة',
    allOpt: 'الكل',
    diffEasy: 'سهل',
    diffMedium: 'متوسط',
    diffHard: 'صعب',
    diffExpert: 'خبير',
    catNav: 'الفئات',
    homeActionsLabel: 'التنقل الرئيسي',
    lbNav: 'لوحة الصدارة',
    lbTitle: 'لوحة الصدارة',
    lbSubtitle: 'أفضل اللاعبين على المنصة',
    lbRank: 'المركز',
    lbPlayer: 'اللاعب',
    lbBest: 'أعلى ربح',
    lbEmpty: 'لا توجد أرقام قياسية بعد. كن أول من يسجل نتيجة!',
    lbLoading: 'جارٍ تحميل لوحة الصدارة…',
    lbError: 'تعذر تحميل لوحة الصدارة حاليًا.',
    lbNickname: 'الاسم المستعار العام',
    lbNicknameHint: 'اختر اسمًا مستعارًا فريدًا (3–20 حرفًا) يظهر في لوحة الصدارة. بدون اسم مستعار لن تُشارك نتائجك.',
    lbSave: 'حفظ الاسم المستعار',
    lbSaved: 'تم حفظ الاسم المستعار. نتائج ألعابك القادمة ستُشارك في اللوحة.',
    lbTaken: 'هذا الاسم المستعار محجوز بالفعل. جرّب اسمًا آخر.',
    lbYourBest: 'رقمك القياسي الشخصي',
    exitTitle: 'مغادرة اللعبة؟',
    exitBody: 'لن يتم حفظ تقدمك ورصيدك الحالي إذا غادرت الآن.',
    exitStay: 'متابعة اللعب',
    exitLeave: 'الخروج إلى الرئيسية',
    exitHomeAria: 'العودة إلى الرئيسية'
  },
  ru: {
    rulesTitle: 'Правила игры',
    rule1: 'В каждой игре 15 вопросов и растущая призовая лестница.',
    rule2: 'У вас 3 попытки. Неверный ответ или истекшее время отнимают одну попытку.',
    rule3: 'Когда попытки заканчиваются, игра завершается по безопасной отметке и текущему банку.',
    rule4: 'Каждая подсказка бесплатна в первый раз. Повторное использование стоит денег из банка.',
    rule5: 'Вы можете выйти в любой момент и забрать текущий выигрыш.',
    readyStart: 'Я готов начать',
    catPill: 'Выберите тему перед выходом в эфир',
    homeQuestions: 'Вопросы',
    homePrize: 'Приз',
    timeoutNotice: 'Время вышло. Вы потеряли одну попытку, переходим к следующему вопросу.',
    wrongNotice: 'Неверный ответ. Вы потеряли одну попытку, переходим к следующему вопросу.',
    fiftyAdvice: 'На экране остались два более сильных ответа.',
    swapAdvice: 'Вопрос заменен новым из той же категории.',
    phoneAdvice: 'Ваш друг считает, что правильный ответ {answer}.',
    audienceAdvice: 'Зал явно склоняется к ответу {letter}.',
    paidDeducted: 'Из текущего банка списано {amount} за повторное использование.',
    winTitle: 'Идеальная победа',
    quitTitle: 'Умный уход',
    timeoutTitle: 'Время вышло',
    lostTitle: 'Попытки закончились',
    resultSummary: 'Вы завершили игру с {correct} правильными ответами, временем игры {time} и выигрышем {prize}.',
    accuracy: 'Точность',
    timeLabel: 'Время',
    shareBtn: 'Поделиться результатом',
    shareText: 'Я выиграл {prize}',
    paidTitle: 'Повторное использование подсказки',
    paidBody: 'Использовать {label} еще раз за {price}?',
    paidPotInfo: 'В текущем банке {pot}. Сумма списывается сразу после подтверждения.',
    confirmPay: 'Подтвердить оплату',
    cancelBtn: 'Отмена',
    fullName: 'Полное имя',
    email: 'Электронная почта',
    message: 'Сообщение',
    sendMsg: 'Отправить сообщение',
    contactSuccess: 'Ваше сообщение получено. Мы скоро свяжемся с вами.',
    addSaved: 'Вопрос сохранен локально и может войти в банк вопросов.',
    gamesPlayed: 'Сыграно игр',
    bestWin: 'Рекордный выигрыш',
    correctTotal: 'Правильные ответы',
    moneyTotal: 'Всего заработано',
    lifelinesUsed: 'Использовано подсказок',
    achievementsLbl: 'Достижения',
    achStudio: 'Вход в студию',
    achMillion: 'Миллион долларов',
    achSenior: 'Опытный игрок',
    achDone: 'Игра завершена',
    soundLbl: 'Звук',
    effectsLbl: 'Визуальные эффекты',
    timerLbl: 'Интенсивность таймера',
    timerCalm: 'Спокойная',
    timerDramatic: 'Драматичная',
    timerIntense: 'Интенсивная',
    resetData: 'Сброс локальных данных',
    manageTitle: 'Управление вопросами',
    poolTitle: 'Банк вопросов',
    poolCount: '{total} вопросов в системе · {shown} показано сейчас',
    searchPh: 'Поиск',
    importExport: 'Импорт и экспорт',
    importBtn: 'Импорт',
    exportBtn: 'Экспорт',
    importFail: 'Импорт не удался. Убедитесь, что текст является корректным JSON.',
    editBtn: 'Редактировать',
    dupBtn: 'Дублировать',
    delBtn: 'Удалить',
    correctLbl: 'Правильный ответ',
    saveQuestion: 'Сохранить вопрос',
    clearForm: 'Очистить форму',
    qLabel: 'Вопрос',
    answerLbl: 'Ответ',
    correctOpt: 'Верный',
    imageLink: 'Ссылка на изображение',
    allOpt: 'Все',
    diffEasy: 'Легкий',
    diffMedium: 'Средний',
    diffHard: 'Сложный',
    diffExpert: 'Эксперт',
    catNav: 'Категории',
    homeActionsLabel: 'Главная навигация',
    lbNav: 'Таблица лидеров',
    lbTitle: 'Таблица лидеров',
    lbSubtitle: 'Лучшие игроки платформы',
    lbRank: 'Место',
    lbPlayer: 'Игрок',
    lbBest: 'Рекордный выигрыш',
    lbEmpty: 'Рекордов пока нет. Станьте первым!',
    lbLoading: 'Загружаем таблицу лидеров…',
    lbError: 'Не удалось загрузить таблицу лидеров.',
    lbNickname: 'Публичный ник',
    lbNicknameHint: 'Выберите уникальный ник (3–20 символов) для таблицы лидеров. Без ника результаты не публикуются.',
    lbSave: 'Сохранить ник',
    lbSaved: 'Ник сохранён. Результаты следующих игр попадут в таблицу.',
    lbTaken: 'Этот ник уже занят. Попробуйте другой.',
    lbYourBest: 'Ваш личный рекорд',
    exitTitle: 'Выйти из игры?',
    exitBody: 'Прогресс и текущий банк не сохранятся, если вы выйдете сейчас.',
    exitStay: 'Продолжить игру',
    exitLeave: 'Выйти на главную',
    exitHomeAria: 'На главную'
  },
  am: {
    rulesTitle: 'የጨዋታው ህጎች',
    rule1: 'እያንዳንዱ ጨዋታ 15 ጥያቄዎች እና እየጨመረ የሚሄድ የሽልማት መደብ አለው።',
    rule2: '3 እድሎች አሉዎት። የተሳሳተ መልስ ወይም ጊዜ ማለቅ አንድ እድል ያስከፍላል።',
    rule3: 'እድሎች ሲያልቁ ጨዋታው በአስተማማኝ ደረጃ እና አሁን ባለው ሽልማት መሠረት ያበቃል።',
    rule4: 'እያንዳንዱ እርዳታ በመጀመሪያ ጊዜ ነፃ ነው። ዳግም መጠቀም ከሽልማቱ ገንዘብ ያስከፍላል።',
    rule5: 'በማንኛውም ጊዜ ወጥተው አሁን ያለውን ሽልማት መውሰድ ይችላሉ።',
    readyStart: 'ለመጀመር ዝግጁ ነኝ',
    catPill: 'ወደ ስርጭት ከመግባትዎ በፊት ርዕስ ይምረጡ',
    homeQuestions: 'ጥያቄዎች',
    homePrize: 'ሽልማት',
    timeoutNotice: 'ጊዜው አልቋል። አንድ እድል አጥተዋል፣ ወደ ቀጣዩ ጥያቄ እንሸጋገራለን።',
    wrongNotice: 'የተሳሳተ መልስ። አንድ እድል አጥተዋል፣ ወደ ቀጣዩ ጥያቄ እንሸጋገራለን።',
    fiftyAdvice: 'በስክሪኑ ላይ ሁለት ጠንካራ መልሶች ቀርተዋል።',
    swapAdvice: 'ጥያቄው ከዚያው ምድብ በአዲስ ጥያቄ ተተክቷል።',
    phoneAdvice: 'ጓደኛዎ መልሱ {answer} ነው ብሎ ያምናል።',
    audienceAdvice: 'ታዳሚው በግልጽ ወደ መልስ {letter} ያዘነብላል።',
    paidDeducted: 'ለዳግም አጠቃቀም {amount} አሁን ካለው ሽልማት ተቀንሷል።',
    winTitle: 'ፍጹም ድል',
    quitTitle: 'ብልህ መውጣት',
    timeoutTitle: 'ጊዜው አልቋል',
    lostTitle: 'እድሎች አልቀዋል',
    resultSummary: 'በ{correct} ትክክለኛ መልሶች፣ በ{time} የጨዋታ ጊዜ እና በ{prize} ሽልማት ጨርሰዋል።',
    accuracy: 'ትክክለኛነት',
    timeLabel: 'ጊዜ',
    shareBtn: 'ውጤት አጋራ',
    shareText: '{prize} አሸንፌያለሁ',
    paidTitle: 'እርዳታን እንደገና መጠቀም',
    paidBody: '{label}ን በ{price} ዋጋ እንደገና መጠቀም ይፈልጋሉ?',
    paidPotInfo: 'አሁን ያለው ሽልማት {pot} ነው። መጠኑ ካረጋገጡ በኋላ ወዲያውኑ ይቀነሳል።',
    confirmPay: 'ክፍያ አረጋግጥ',
    cancelBtn: 'ሰርዝ',
    fullName: 'ሙሉ ስም',
    email: 'ኢሜይል',
    message: 'መልእክት',
    sendMsg: 'መልእክት ላክ',
    contactSuccess: 'መልእክትዎ ደርሷል። በቅርቡ እንመለስልዎታለን።',
    addSaved: 'ጥያቄው በአካባቢው ተቀምጧል እና ወደ ጥያቄዎች ባንክ መግባት ይችላል።',
    gamesPlayed: 'የተጫወቱ ጨዋታዎች',
    bestWin: 'ከፍተኛ ሽልማት',
    correctTotal: 'ትክክለኛ መልሶች',
    moneyTotal: 'ጠቅላላ የተጠራቀመ ገንዘብ',
    lifelinesUsed: 'የተጠቀሙ እርዳታዎች',
    achievementsLbl: 'ስኬቶች',
    achStudio: 'ወደ ስቱዲዮ መግባት',
    achMillion: 'አንድ ሚሊዮን ዶላር',
    achSenior: 'ከፍተኛ ተጫዋች',
    achDone: 'ጨዋታ ተጠናቋል',
    soundLbl: 'ድምጽ',
    effectsLbl: 'የእይታ ውጤቶች',
    timerLbl: 'የሰዓት ቆጣሪ ጥንካሬ',
    timerCalm: 'የተረጋጋ',
    timerDramatic: 'ድራማዊ',
    timerIntense: 'ጠንካራ',
    resetData: 'የአካባቢ ውሂብ ዳግም አስጀምር',
    manageTitle: 'የጥያቄዎች አስተዳደር',
    poolTitle: 'የጥያቄዎች ባንክ',
    poolCount: '{total} ጥያቄዎች በስርዓቱ · {shown} አሁን ይታያሉ',
    searchPh: 'ፍለጋ',
    importExport: 'ማስመጣት እና መላክ',
    importBtn: 'አስመጣ',
    exportBtn: 'ላክ',
    importFail: 'ማስመጣት አልተሳካም። ጽሑፉ ትክክለኛ JSON መሆኑን ያረጋግጡ።',
    editBtn: 'አርትዕ',
    dupBtn: 'ቅዳ',
    delBtn: 'ሰርዝ',
    correctLbl: 'ትክክለኛ መልስ',
    saveQuestion: 'ጥያቄ አስቀምጥ',
    clearForm: 'ቅጹን አጽዳ',
    qLabel: 'ጥያቄ',
    answerLbl: 'መልስ',
    correctOpt: 'ትክክል',
    imageLink: 'የምስል አገናኝ',
    allOpt: 'ሁሉም',
    diffEasy: 'ቀላል',
    diffMedium: 'መካከለኛ',
    diffHard: 'ከባድ',
    diffExpert: 'ባለሙያ',
    catNav: 'ምድቦች',
    homeActionsLabel: 'ዋና ዳሰሳ',
    lbNav: 'የደረጃ ሰሌዳ',
    lbTitle: 'የደረጃ ሰሌዳ',
    lbSubtitle: 'በመድረኩ ላይ ምርጥ ተጫዋቾች',
    lbRank: 'ደረጃ',
    lbPlayer: 'ተጫዋች',
    lbBest: 'ከፍተኛ ሽልማት',
    lbEmpty: 'እስካሁን ምንም ሪከርድ የለም። የመጀመሪያው ይሁኑ!',
    lbLoading: 'የደረጃ ሰሌዳውን በመጫን ላይ…',
    lbError: 'የደረጃ ሰሌዳውን አሁን መጫን አልቻልንም።',
    lbNickname: 'የሕዝብ ቅጽል ስም',
    lbNicknameHint: 'በሰሌዳው ላይ የሚታይ ልዩ ቅጽል ስም ይምረጡ (3–20 ፊደላት)። ያለ ቅጽል ስም ውጤቶችዎ አይጋሩም።',
    lbSave: 'ቅጽል ስም አስቀምጥ',
    lbSaved: 'ቅጽል ስሙ ተቀምጧል። የሚቀጥሉት ጨዋታዎች ውጤቶች ወደ ሰሌዳው ይጋራሉ።',
    lbTaken: 'ይህ ቅጽል ስም አስቀድሞ ተይዟል። ሌላ ይሞክሩ።',
    lbYourBest: 'የግል ሪከርድዎ',
    exitTitle: 'ከጨዋታው መውጣት?',
    exitBody: 'አሁን ከወጡ እድገትዎ እና ያለው ሽልማት አይቀመጡም።',
    exitStay: 'መጫወት ቀጥል',
    exitLeave: 'ወደ መነሻ ውጣ',
    exitHomeAria: 'ወደ መነሻ ተመለስ'
  }
};

function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

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

function money(value: number) {
  // Global audience: all prizes are shown in US dollars.
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function priceFor(type: Lifeline, pot: number) {
  const fixed = type === 'fifty' ? 5000 : type === 'swap' ? 8000 : type === 'audience' ? 10000 : 12000;
  return Math.min(fixed, Math.max(0, Math.floor(pot * 0.25)));
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

const TONES: Record<string, { notes: number[]; type: OscillatorType; step: number; length: number; volume: number }> = {
  win: { notes: [523, 659, 784, 1046, 1318, 1568], type: 'sine', step: 0.11, length: 0.34, volume: 0.14 },
  correct: { notes: [523, 659, 784], type: 'triangle', step: 0.07, length: 0.22, volume: 0.13 },
  wrong: { notes: [220, 160, 110], type: 'sawtooth', step: 0.09, length: 0.24, volume: 0.1 },
  timeout: { notes: [440, 350, 262, 196], type: 'square', step: 0.12, length: 0.26, volume: 0.09 },
  countdown: { notes: [520], type: 'sine', step: 0.08, length: 0.12, volume: 0.1 },
  click: { notes: [660], type: 'triangle', step: 0.05, length: 0.09, volume: 0.08 },
  start: { notes: [392, 523, 659, 784], type: 'sine', step: 0.09, length: 0.28, volume: 0.13 },
  lifeline: { notes: [880, 1174, 1568], type: 'sine', step: 0.06, length: 0.16, volume: 0.11 },
  safe: { notes: [659, 784, 988, 1318], type: 'triangle', step: 0.1, length: 0.3, volume: 0.12 },
  cashout: { notes: [784, 659, 784, 1046], type: 'sine', step: 0.1, length: 0.26, volume: 0.12 },
  suspense: { notes: [196, 208], type: 'sine', step: 0.16, length: 0.4, volume: 0.06 }
};

const INFO_UI: Record<Locale, { correct: string; wrong: string; answer: string; next: string; action: string }> = {
  he: { correct: 'תשובה נכונה', wrong: 'כמעט. הנה ההסבר', answer: 'התשובה הנכונה', next: 'קראו את ההסבר והמשיכו כשתהיו מוכנים', action: 'לשאלה הבאה' },
  en: { correct: 'Correct answer', wrong: 'Almost. Here is the insight', answer: 'Correct answer', next: 'Read the explanation and continue when you are ready', action: 'Next question' },
  ar: { correct: 'إجابة صحيحة', wrong: 'قريب. إليك التوضيح', answer: 'الإجابة الصحيحة', next: 'اقرأ التوضيح وتابع عندما تكون جاهزًا', action: 'السؤال التالي' },
  ru: { correct: 'Правильный ответ', wrong: 'Почти. Вот пояснение', answer: 'Правильный ответ', next: 'Прочитайте пояснение и продолжите, когда будете готовы', action: 'Следующий вопрос' },
  am: { correct: 'ትክክለኛ መልስ', wrong: 'ቅርብ ነበር። ማብራሪያው ይህ ነው', answer: 'ትክክለኛው መልስ', next: 'ማብራሪያውን አንብበው ዝግጁ ሲሆኑ ይቀጥሉ', action: 'ቀጣዩ ጥያቄ' }
};

const COMMUNITY_UI: Record<Locale, Record<string, string>> = {
  he: {
    submitNav: 'שליחת שאלה',
    submitTitle: 'שליחת שאלה לקהילה',
    submitIntro: 'הוסיפו שאלה חדשה למאגר. המערכת בודקת איכות, כפילויות וניסוח לפני פרסום.',
    contributorName: 'שם',
    contributorEmail: 'אימייל',
    language: 'שפה',
    category: 'קטגוריה',
    difficulty: 'רמת קושי',
    question: 'שאלה',
    explanation: 'הסבר קצר',
    correctAnswer: 'תשובה נכונה',
    send: 'שליחה לבדיקה',
    autoApproved: 'השאלה אושרה אוטומטית ונוספה למשחק.',
    needsReview: 'השאלה נשלחה לבדיקת מנהל לפני פרסום.',
    rejected: 'השאלה נדחתה כרגע. אפשר לשפר ניסוח ולשלוח שוב.',
    dashboard: 'מרכז בקרת תוכן קהילתי',
    reviewQueue: 'תור בדיקה',
    auditLog: 'יומן פעולות',
    submissions: 'הגשות',
    pending: 'ממתינות',
    approved: 'אושרו',
    rejectedLabel: 'נדחו',
    confidence: 'ציון',
    recommendation: 'המלצת מערכת',
    reasons: 'סיבות',
    approve: 'אישור פרסום',
    reject: 'דחייה',
    emptyQueue: 'אין שאלות שממתינות לבדיקה.',
    localMode: 'מצב מקומי פעיל. חיבור למסד נתונים, הרשאות ו-AI אמיתי יתווסף בשלב הבא.',
    answer: 'תשובה'
  },
  en: {
    submitNav: 'Submit Question',
    submitTitle: 'Submit a Community Question',
    submitIntro: 'Add a new question to the pool. The system checks quality, duplicates and wording before publishing.',
    contributorName: 'Name',
    contributorEmail: 'Email',
    language: 'Language',
    category: 'Category',
    difficulty: 'Difficulty',
    question: 'Question',
    explanation: 'Short explanation',
    correctAnswer: 'Correct answer',
    send: 'Send for review',
    autoApproved: 'The question was approved automatically and added to the game.',
    needsReview: 'The question was sent to admin review before publishing.',
    rejected: 'The question was rejected for now. Improve it and submit again.',
    dashboard: 'Community Content Control',
    reviewQueue: 'Review queue',
    auditLog: 'Audit log',
    submissions: 'Submissions',
    pending: 'Pending',
    approved: 'Approved',
    rejectedLabel: 'Rejected',
    confidence: 'Score',
    recommendation: 'System recommendation',
    reasons: 'Reasons',
    approve: 'Approve',
    reject: 'Reject',
    emptyQueue: 'No questions are waiting for review.',
    localMode: 'Local mode is active. Database, permissions and real AI will connect in the next phase.',
    answer: 'Answer'
  },
  ar: {
    submitNav: 'إرسال سؤال',
    submitTitle: 'إرسال سؤال للمجتمع',
    submitIntro: 'أضف سؤالا جديدا إلى البنك. يفحص النظام الجودة والتكرار والصياغة قبل النشر.',
    contributorName: 'الاسم',
    contributorEmail: 'البريد الإلكتروني',
    language: 'اللغة',
    category: 'الفئة',
    difficulty: 'مستوى الصعوبة',
    question: 'السؤال',
    explanation: 'شرح قصير',
    correctAnswer: 'الإجابة الصحيحة',
    send: 'إرسال للمراجعة',
    autoApproved: 'تمت الموافقة على السؤال تلقائيا وإضافته إلى اللعبة.',
    needsReview: 'تم إرسال السؤال إلى مراجعة المدير قبل النشر.',
    rejected: 'تم رفض السؤال حاليا. يمكن تحسينه وإرساله مرة أخرى.',
    dashboard: 'مركز إدارة محتوى المجتمع',
    reviewQueue: 'قائمة المراجعة',
    auditLog: 'سجل العمليات',
    submissions: 'الإرسالات',
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة',
    rejectedLabel: 'مرفوضة',
    confidence: 'الدرجة',
    recommendation: 'توصية النظام',
    reasons: 'الأسباب',
    approve: 'موافقة للنشر',
    reject: 'رفض',
    emptyQueue: 'لا توجد أسئلة تنتظر المراجعة.',
    localMode: 'الوضع المحلي نشط. سيتم ربط قاعدة البيانات والصلاحيات والذكاء الاصطناعي الحقيقي في المرحلة التالية.',
    answer: 'إجابة'
  },
  ru: {
    submitNav: 'Отправить вопрос',
    submitTitle: 'Отправить вопрос сообщества',
    submitIntro: 'Добавьте новый вопрос в банк. Система проверяет качество, повторы и формулировку перед публикацией.',
    contributorName: 'Имя',
    contributorEmail: 'Электронная почта',
    language: 'Язык',
    category: 'Категория',
    difficulty: 'Сложность',
    question: 'Вопрос',
    explanation: 'Короткое объяснение',
    correctAnswer: 'Правильный ответ',
    send: 'Отправить на проверку',
    autoApproved: 'Вопрос автоматически одобрен и добавлен в игру.',
    needsReview: 'Вопрос отправлен администратору на проверку перед публикацией.',
    rejected: 'Вопрос пока отклонен. Его можно улучшить и отправить снова.',
    dashboard: 'Центр управления контентом сообщества',
    reviewQueue: 'Очередь проверки',
    auditLog: 'Журнал действий',
    submissions: 'Отправки',
    pending: 'Ожидают',
    approved: 'Одобрены',
    rejectedLabel: 'Отклонены',
    confidence: 'Оценка',
    recommendation: 'Рекомендация системы',
    reasons: 'Причины',
    approve: 'Одобрить публикацию',
    reject: 'Отклонить',
    emptyQueue: 'Нет вопросов, ожидающих проверки.',
    localMode: 'Включен локальный режим. База данных, права доступа и настоящий AI будут подключены на следующем этапе.',
    answer: 'Ответ'
  },
  am: {
    submitNav: 'ጥያቄ ላክ',
    submitTitle: 'የማህበረሰብ ጥያቄ ላክ',
    submitIntro: 'አዲስ ጥያቄ ወደ ማዕከሉ ያክሉ። ስርዓቱ ከህትመት በፊት ጥራትን፣ ተደጋጋሚነትን እና አጻጻፍን ይፈትሻል።',
    contributorName: 'ስም',
    contributorEmail: 'ኢሜይል',
    language: 'ቋንቋ',
    category: 'ምድብ',
    difficulty: 'የክብደት ደረጃ',
    question: 'ጥያቄ',
    explanation: 'አጭር ማብራሪያ',
    correctAnswer: 'ትክክለኛ መልስ',
    send: 'ለግምገማ ላክ',
    autoApproved: 'ጥያቄው በራስ ሰር ጸድቆ ወደ ጨዋታው ተጨምሯል።',
    needsReview: 'ጥያቄው ከህትመት በፊት ወደ አስተዳዳሪ ግምገማ ተልኳል።',
    rejected: 'ጥያቄው ለጊዜው ተቀባይነት አላገኘም። ማሻሻል እና እንደገና መላክ ይቻላል።',
    dashboard: 'የማህበረሰብ ይዘት መቆጣጠሪያ',
    reviewQueue: 'የግምገማ ዝርዝር',
    auditLog: 'የእርምጃዎች መዝገብ',
    submissions: 'የተላኩ',
    pending: 'በግምገማ',
    approved: 'ጸድቀዋል',
    rejectedLabel: 'ውድቅ ተደርገዋል',
    confidence: 'ውጤት',
    recommendation: 'የስርዓት ምክር',
    reasons: 'ምክንያቶች',
    approve: 'ለህትመት አጽድቅ',
    reject: 'ውድቅ አድርግ',
    emptyQueue: 'ለግምገማ የሚጠብቁ ጥያቄዎች የሉም።',
    localMode: 'አካባቢያዊ ሁነታ ነቅቷል። ዳታቤዝ፣ ፈቃዶች እና እውነተኛ AI በሚቀጥለው ደረጃ ይገናኛሉ።',
    answer: 'መልስ'
  }
};

function tone(kind: string, enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  const ctx = new AudioCtor();
  const preset = TONES[kind] || TONES.click;
  preset.notes.forEach((freq, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = preset.type;
    oscillator.frequency.value = freq;
    const start = ctx.currentTime + index * preset.step;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(preset.volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + preset.length);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + preset.length + 0.03);
  });
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

function legacyCurrencyAchievement() {
  return `מיליון ${String.fromCharCode(1513, 1511, 1500, 1497, 1501)}`;
}

function normalizeStats(stats: Stats): Stats {
  return {
    ...stats,
    achievements: stats.achievements.map(item => item === legacyCurrencyAchievement() ? 'מיליון דולר' : item)
  };
}

export default function TriviaPlatform({ questions, initialScreen = 'home', adminHeader }: { questions: Question[]; initialScreen?: Screen; adminHeader?: ReactNode }) {
  const [loadedQuestions, setLoadedQuestions] = useState<Question[]>(questions);
  const baseQuestions = useMemo(() => loadedQuestions.map(normalize), [loadedQuestions]);
  const [locale, setLocale] = useState<Locale>('he');
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [extraQuestions, setExtraQuestions] = useState<GameQuestion[]>([]);
  const [settings, setSettings] = useState<Settings>({ sound: true, effects: true, timer: 'דרמטית' });
  const [stats, setStats] = useState<Stats>({ games: 0, bestPrize: 0, totalMoney: 0, correct: 0, lifelines: 0, achievements: ['כניסה לאולפן'] });
  const [category, setCategory] = useState('הכול');
  const [gameSet, setGameSet] = useState<GameQuestion[]>([]);
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState([0, 1, 2, 3]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hiddenAnswers, setHiddenAnswers] = useState<number[]>([]);
  const [timer, setTimer] = useState(45);
  const [chances, setChances] = useState(3);
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
  const [authUser, setAuthUser] = useState<PublicAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const advanceTimeoutRef = useRef<number | null>(null);
  const advancingRef = useRef(false);

  const t = { ...UI[locale], ...UI_EXT[locale] };
  const authT = AUTH_UI[locale] || AUTH_UI.en;
  const communityT = COMMUNITY_UI[locale] || COMMUNITY_UI.he;
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
  const current = gameSet[round] ? localizeQuestion(gameSet[round], locale) : undefined;
  const currentPrize = MONEY[Math.max(0, round - 1)] || 0;
  const nextPrize = MONEY[round] || MONEY[MONEY.length - 1];
  const guaranteedPrize = round > 9 ? MONEY[9] : round > 4 ? MONEY[4] : 0;
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
    setCommunitySubmissions(readLocal(COMMUNITY_KEY, []));
    setAuditLogs(readLocal(AUDIT_KEY, []));
    // Invitation deep-links (/?join=...) land directly on the multiplayer screen.
    if (new URLSearchParams(window.location.search).get('join')) setScreen('multiplayer');
    setSettings(readLocal(SETTINGS_KEY, { sound: true, effects: true, timer: 'דרמטית' }));
    setStats(normalizeStats(readLocal(STATS_KEY, { games: 0, bestPrize: 0, totalMoney: 0, correct: 0, lifelines: 0, achievements: ['כניסה לאולפן'] })));
    setNicknameState(readLocal(NICKNAME_KEY, ''));
    void refreshLeaderboard();
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

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(() => {
      fetch('/api/questions', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : undefined)
        .then(data => {
          if (!active || !Array.isArray(data?.questions)) return;
          setLoadedQuestions(current => data.questions.length > current.length ? data.questions : current);
        })
        .catch(() => undefined);
    }, 900);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
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
  }, [screen, round]);

  useEffect(() => {
    if (screen !== 'game' || selected !== null) return;
    if (timer <= 0) {
      loseChance('timeout');
      return;
    }
    const id = window.setTimeout(() => {
      setTimer(value => value - 1);
      if (timer <= 6) tone('countdown', settings.sound);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [screen, selected, settings.sound, timer]);

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
    tone('click', settings.sound);
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
    tone('click', settings.sound);
  }

  function startGame(nextCategory = category) {
    clearAdvanceTimer();
    advancingRef.current = false;
    const available = shuffle(playableQuestions.filter(question => nextCategory === 'הכול' || question.category === nextCategory));
    if (available.length < 4) return;
    let pool = available.slice(0, 15);
    if (pool.length < 15) {
      const filled: GameQuestion[] = [];
      while (filled.length < 15) filled.push(...shuffle(available));
      pool = filled.slice(0, 15);
    }
    setCategory(nextCategory);
    setGameSet(pool);
    setRound(0);
    setOrder(shuffle([0, 1, 2, 3]));
    setSelected(null);
    setHiddenAnswers([]);
    setTimer(45);
    setChances(3);
    setLifelineUses({ fifty: 0, swap: 0, phone: 0, audience: 0 });
    setAdvice('');
    setNotice('');
    setElapsed(0);
    setScreen('game');
    tone('start', settings.sound);
  }

  function nextQuestion() {
    clearAdvanceTimer();
    advancingRef.current = false;
    if (round >= 14) {
      finish('win', MONEY[14]);
      return;
    }
    if (SAFE_STEPS.includes(round)) tone('safe', settings.sound);
    setRound(value => value + 1);
    setOrder(shuffle([0, 1, 2, 3]));
    setSelected(null);
    setHiddenAnswers([]);
    setTimer(45);
    setAdvice('');
    setNotice('');
  }

  function completeAnsweredQuestion(answerIndex: number) {
    if (!current) return;
    if (answerIndex === current.correctIndex) {
      nextQuestion();
      return;
    }
    if (chances > 1) {
      setChances(value => value - 1);
      nextQuestion();
      return;
    }
    finish('lost', guaranteedPrize);
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
    tone(correct ? 'correct' : 'wrong', settings.sound);
    // No auto-advance after answering: the player reviews the explanation and
    // chooses when to continue via the Next button (or keyboard). The timeout
    // path below still expires unanswered questions automatically.
  }

  function loseChance(reason: EndState) {
    if (reason === 'timeout') tone('timeout', settings.sound);
    if (chances > 1) {
      setChances(value => value - 1);
      setNotice(reason === 'timeout' ? t.timeoutNotice : t.wrongNotice);
      scheduleAdvance(nextQuestion);
      return;
    }
    finish(reason, guaranteedPrize);
  }

  function finish(state: EndState, prize: number) {
    clearAdvanceTimer();
    setEndState(state);
    setFinalPrize(prize);
    setScreen('result');
    tone(state === 'win' ? 'win' : state === 'quit' ? 'cashout' : state === 'timeout' ? 'timeout' : 'wrong', settings.sound);
    const lifelines = Object.values(lifelineUses).reduce((sum, value) => sum + value, 0);
    setStats(previous => ({
      games: previous.games + 1,
      bestPrize: Math.max(previous.bestPrize, prize),
      totalMoney: previous.totalMoney + prize,
      correct: previous.correct + round,
      lifelines: previous.lifelines + lifelines,
      achievements: Array.from(new Set([...previous.achievements, prize >= 1000000 ? 'מיליון דולר' : prize >= 250000 ? 'שחקן בכיר' : 'משחק הושלם']))
    }));
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
    tone('lifeline', settings.sound);
    if (type === 'fifty') {
      setHiddenAnswers(order.filter(index => index !== current.correctIndex).slice(0, 2));
      setAdvice(t.fiftyAdvice);
    }
    if (type === 'swap') {
      const usedIds = new Set(gameSet.map(item => item.id));
      const replacement = shuffle(playableQuestions.filter(question => question.category === gameSet[round].category && !usedIds.has(question.id)))[0];
      if (replacement) {
        setGameSet(previous => previous.map((item, index) => index === round ? replacement : item));
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
    if (price > 0) setNotice(fmt(t.paidDeducted, { amount: money(price) }));
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
          tone('correct', settings.sound);
        } else if (submission.moderation.status === 'rejected') {
          tone('wrong', settings.sound);
        } else {
          tone('safe', settings.sound);
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
      tone('correct', settings.sound);
    } else if (moderation.status === 'rejected') {
      tone('wrong', settings.sound);
    } else {
      tone('safe', settings.sound);
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
        tone('correct', settings.sound);
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
    tone('correct', settings.sound);
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
        tone('wrong', settings.sound);
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
    tone('wrong', settings.sound);
  }

  return (
    <main className={`app-shell font-hebrew premium-typography ${screen === 'game' ? 'game-active' : ''} ${screen === 'admin' ? 'admin-active' : ''}`} dir={dir}>
      {settings.effects && <Particles />}
      {/* Single shared utility bar: language (physical left) and account (physical
          right) live in one flex row, so they can never overlap on any device. */}
      <div className="top-utility-bar" dir="ltr">
        <div className="language-corner">
          <LanguageMenu locale={locale} setLocale={setLocale} />
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
      {screen !== 'home' && <Header t={t} submitLabel={communityT.submitNav} multiplayerLabel={multiplayerCopy.nav} open={open} start={() => open('categories')} />}
      <div ref={screenSectionRef} tabIndex={-1} className="screen-section">
      {screen === 'home' && <Home t={t} locale={locale} questionCount={playableQuestions.length} soloLabel={multiplayerCopy.solo} multiplayerLabel={multiplayerCopy.multiplayer} start={() => startGame('הכול')} open={open} />}
      {screen === 'categories' && <Categories t={t} locale={locale} categories={categories} questions={playableQuestions} startGame={startGame} />}
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
          quit={() => finish('quit', currentPrize || guaranteedPrize)}
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
      {screen === 'profile' && <PremiumProfile t={t} authUi={authT} user={authUser} nickname={nickname} stats={stats} />}
      {screen === 'settings' && <SettingsPanel t={t} settings={settings} setSettings={setSettings} reset={() => { localStorage.clear(); location.reload(); }} />}
      </div>
      {pendingPaid && <PaidModal t={t} pending={pendingPaid} pot={currentPrize} cancel={() => setPendingPaid(null)} confirm={() => applyLifeline(pendingPaid.type, pendingPaid.price)} />}
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

function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 34 }, (_, index) => (
        <span
          key={index}
          className="particle"
          style={{
            right: `${(index * 29) % 100}%`,
            animationDelay: `${-(index * 1.7)}s`,
            ['--duration' as string]: `${24 + (index % 8)}s`,
            ['--opacity' as string]: `${0.24 + (index % 6) * 0.08}`,
            ['--x' as string]: `${(index % 2 ? 80 : -70) + index}px`
          }}
        />
      ))}
    </div>
  );
}

function Header({ t, submitLabel, multiplayerLabel, open, start }: { t: Record<string, string>; submitLabel: string; multiplayerLabel: string; open: (screen: Screen) => void; start: () => void }) {
  // Public header: admin/editor tools are intentionally absent. The admin
  // dashboard is reachable only through the protected /admin route.
  return (
    <header className="public-header relative z-20 mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-5 pt-5 md:flex-row md:items-center md:justify-between lg:px-8">
      <button className="focus-ring flex items-center gap-3 text-right" onClick={() => open('home')}>
        <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-gold text-royal shadow-gold">♕</span>
        <span><strong className="block text-xl font-black">{t.headline}</strong><small className="text-white/65">{t.subtitle}</small></span>
      </button>
      <nav className="flex flex-wrap items-center gap-3">
        <button className="ghost-button focus-ring" onClick={() => open('rules')}>{t.rules}</button>
        <button className="ghost-button focus-ring" onClick={() => open('multiplayer')}>{multiplayerLabel}</button>
        <button className="ghost-button focus-ring" onClick={() => open('leaderboard')}>{t.lbNav}</button>
        <button className="ghost-button focus-ring" onClick={() => open('submit')}>{submitLabel}</button>
        <button className="ghost-button focus-ring" onClick={() => open('contact')}>{t.contact}</button>
        <button className="ghost-button focus-ring" onClick={() => open('profile')}>{t.profile}</button>
        <button className="ghost-button focus-ring" onClick={() => open('settings')}>{t.settings}</button>
        <button className="premium-button focus-ring" onClick={start}>{t.start}</button>
      </nav>
    </header>
  );
}

function LanguageMenu({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = LANGUAGE_OPTIONS.find(item => item.value === locale) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [open]);

  return (
    <div className="language-menu" ref={menuRef}>
      <button
        className="language-trigger language-icon-trigger focus-ring"
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Language: ${active.native}`}
        title="Language"
      >
        <span className="language-globe" aria-hidden="true"><Globe size={22} /></span>
        <span className="sr-only">Language: {active.native}</span>
      </button>
      {open && (
        <div className="language-panel glass" role="menu" aria-label="Choose language">
          {LANGUAGE_OPTIONS.map(item => (
            <button
              key={item.value}
              type="button"
              className={item.value === locale ? 'language-option active' : 'language-option'}
              role="menuitemradio"
              aria-checked={item.value === locale}
              onClick={() => {
                setLocale(item.value);
                setOpen(false);
              }}
            >
              <span>{item.native}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicAuthArea({
  ui,
  user,
  ready,
  configured,
  nickname,
  leaderboardStatus,
  saveNickname,
  open,
  signOut
}: {
  ui: Record<string, string>;
  user: PublicAuthUser | null;
  ready: boolean;
  configured: boolean;
  nickname: string;
  leaderboardStatus: LeaderboardStatus;
  saveNickname: (value: string) => void | Promise<void>;
  open: (screen: Screen) => void;
  signOut: () => void | Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(nickname);

  useEffect(() => {
    setDraft(nickname);
  }, [nickname]);

  const displayName = nickname || user?.displayName || user?.email?.split('@')[0] || ui.guest;
  const validation = validateNickname(draft, ui);
  const shouldPromptNickname = Boolean(user && !nickname);
  const initials = initialsFor(displayName);

  if (!ready) {
    return (
      <div className="public-auth-corner" aria-label={ui.account}>
        <div className="public-auth-skeleton" />
      </div>
    );
  }

  if (!configured || !user) {
    return (
      <nav className="public-auth-corner public-auth-actions" aria-label={ui.account}>
        <a className="auth-link-button secondary focus-ring" href="/login">{ui.signIn}</a>
        <a className="auth-link-button primary focus-ring" href="/signup">{ui.createAccount}</a>
      </nav>
    );
  }

  return (
    <div className="public-auth-corner public-user-menu">
      <button
        type="button"
        className="public-user-trigger focus-ring"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(value => !value)}
      >
        <Avatar user={user} initials={initials} />
        <span>
          <strong>{displayName}</strong>
          <small>{user.email || ui.account}</small>
        </span>
      </button>

      {menuOpen && (
        <div className="public-user-dropdown glass" role="menu">
          {shouldPromptNickname && (
            <section className="nickname-prompt" aria-label={ui.chooseNickname}>
              <strong>{ui.chooseNickname}</strong>
              <p>{ui.nicknamePrompt}</p>
              <input
                className="form-input"
                value={draft}
                maxLength={20}
                onChange={event => setDraft(event.target.value)}
                placeholder={ui.nicknamePlaceholder}
              />
              <small className={validation.ok ? 'nickname-valid' : 'nickname-invalid'}>{validation.message}</small>
              <button
                type="button"
                className="premium-button focus-ring w-full"
                disabled={!validation.ok || leaderboardStatus === 'saving'}
                onClick={() => void saveNickname(draft)}
              >
                {ui.saveNickname}
              </button>
            </section>
          )}
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('profile'); }}>{ui.profile}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('profile'); }}>{ui.stats}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('profile'); }}>{ui.achievements}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('leaderboard'); }}>{ui.leaderboard}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); open('settings'); }}>{ui.settings}</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); void signOut(); }}>{ui.logout}</button>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, initials }: { user: PublicAuthUser; initials: string }) {
  return user.avatarUrl
    ? <img className="public-avatar" src={user.avatarUrl} alt="" />
    : <span className="public-avatar" aria-hidden="true">{initials}</span>;
}

function Home({ t, locale, questionCount, soloLabel, multiplayerLabel, start, open }: { t: Record<string, string>; locale: Locale; questionCount: number; soloLabel: string; multiplayerLabel: string; start: () => void; open: (screen: Screen) => void }) {
  const formattedQuestionCount = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : locale).format(questionCount);
  return (
    <section className="home-landing mx-auto w-full max-w-[1680px] px-5 pb-16 lg:px-8">
      {/* Hero first: intro through the single primary Start Game button. */}
      <div className="grid items-center gap-12 lg:grid-cols-[.86fr_1fr]">
        <div className="glass relative min-h-[420px] overflow-hidden rounded-[36px] p-8 lg:min-h-[560px]">
          <div className="absolute inset-8 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid h-full place-items-center text-center">
            <div>
              <div className="mb-7 text-6xl text-gold drop-shadow-[0_0_26px_rgba(247,202,103,.55)]"><Trophy size={56} aria-hidden="true" /></div>
              <div className="home-prize-amount text-6xl font-black md:text-7xl">{money(1000000)}</div>
              <p className="mt-8 text-white/65">{t.live}</p>
              <div className="mx-auto mt-8 h-2 w-80 rounded-full bg-gradient-to-l from-gold to-azure" />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="mb-8 w-fit rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold shadow-gold"><Sparkles size={14} aria-hidden="true" /> {t.pill}</p>
          <h1 className="text-6xl font-black leading-[.92] md:text-[112px]">{t.headline}</h1>
          <p className="mt-7 max-w-4xl text-2xl font-bold leading-9 text-white/78">{t.intro}</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <button className="premium-button focus-ring text-lg" onClick={start}>{soloLabel}</button>
            <button className="ghost-button focus-ring text-lg" onClick={() => open('multiplayer')}>{multiplayerLabel}</button>
          </div>
        </div>
      </div>

      {/* Public navigation/actions below the hero. No admin/editor tools here. */}
      <nav className="home-actions" aria-label={t.homeActionsLabel}>
        <button className="ghost-button focus-ring" onClick={() => open('rules')}>{t.rules}</button>
        <button className="ghost-button focus-ring" onClick={() => open('categories')}>{t.catNav}</button>
        <button className="ghost-button focus-ring" onClick={() => open('leaderboard')}>{t.lbNav}</button>
        <button className="ghost-button focus-ring" onClick={() => open('submit')}>{(COMMUNITY_UI[locale] || COMMUNITY_UI.he).submitNav}</button>
        <button className="ghost-button focus-ring" onClick={() => open('profile')}>{t.profile}</button>
        <button className="ghost-button focus-ring" onClick={() => open('contact')}>{t.contact}</button>
        <button className="ghost-button focus-ring" onClick={() => open('settings')}>{t.settings}</button>
      </nav>

      <div className="mt-9 grid gap-4 md:grid-cols-3">
        <Metric value={`${formattedQuestionCount}+`} label={t.homeQuestions} />
        <Metric value="3" label={t.chancesLabel} />
        <Metric value={money(1000000)} label={t.homePrize} gold />
      </div>
      <AdSlot placement="homepage-hero-below" className="mt-4" />
      <AdSlot placement="homepage-content" className="mt-8" />
    </section>
  );
}

function Categories({ t, locale, categories, questions, startGame }: { t: Record<string, string>; locale: Locale; categories: string[]; questions: GameQuestion[]; startGame: (category: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <p className="mb-8 mr-auto w-fit rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold"><Sparkles size={14} aria-hidden="true" /> {t.catPill}</p>
      <h1 className="max-w-5xl text-6xl font-black md:text-[86px]">{t.choose}</h1>
      <p className="mt-5 max-w-4xl text-xl leading-8 text-white/72">{t.chooseText}</p>
      <AdSlot placement="categories-top" className="mt-7" />
      <button className="ghost-button focus-ring mt-8 lg:min-w-56" onClick={() => startGame('הכול')}>{t.all}</button>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {categories.map(category => (
          <button key={category} className="category-card focus-ring glass rounded-[30px] p-6 text-right" onClick={() => startGame(category)}>
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold"><Sparkles size={18} aria-hidden="true" /></span>
            <strong className="block text-3xl font-black">{localizeCategory(locale, category)}</strong>
            <em className="mt-3 block not-italic text-white/65">{localizeCategoryDescription(locale, category)}</em>
            <small className="mt-6 inline-block rounded-full border border-white/15 px-4 py-2 text-white/70">{questions.filter(question => question.category === category).length} {t.available}</small>
          </button>
        ))}
      </div>
      <AdSlot placement="categories-grid-after" className="mt-8" />
    </section>
  );
}

function Rules({ t, start }: { t: Record<string, string>; start: () => void }) {
  const rules = [t.rule1, t.rule2, t.rule3, t.rule4, t.rule5];
  return (
    <Panel title={t.rulesTitle} icon={<ScrollText size={26} aria-hidden="true" />}>
      <div className="grid gap-4">{rules.map((rule, index) => <div key={rule} className="rule-row"><span>{index + 1}</span><p>{rule}</p></div>)}</div>
      <button className="premium-button focus-ring mt-9 text-lg" onClick={start}>{t.readyStart}</button>
    </Panel>
  );
}

function Game(props: {
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
          <span className="game-topline-chances" aria-label={t.chancesLabel}>{[0, 1, 2].map(index => <span key={index} className={index < chances ? 'text-ember' : 'text-white/22'}><Heart size={13} fill="currentColor" aria-hidden="true" /></span>)}</span>
          <span className={`game-topline-timer ${timerUrgency}`}><TimerIcon size={16} aria-hidden="true" /> {timer}</span>
          <span className="game-topline-pot">{money(currentPrize)}</span>
        </div>
        {current.imageUrl && <img src={current.imageUrl} alt="תמונת שאלה" className="mb-6 max-h-72 w-full rounded-3xl object-cover" />}
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
            <div className="answer-info-icon" aria-hidden="true">{answerInfo.correct ? <Check size={20} aria-hidden="true" /> : <AlertTriangle size={20} aria-hidden="true" />}</div>
            <div className="answer-info-content">
              <div className="answer-info-header">
                <strong>{answerInfo.correct ? infoUi.correct : infoUi.wrong}</strong>
                <span>{infoUi.answer}: {answerInfo.answer}</span>
              </div>
              <p>{answerInfo.explanation}</p>
              <div className="answer-info-actions">
                <em>{infoUi.next}</em>
                <button className="answer-info-next focus-ring" type="button" autoFocus onClick={advanceAfterAnswer}>{infoUi.action} ↵</button>
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
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-extrabold">{t.lifelines}</h3><span className="text-gold"><Sparkles size={16} aria-hidden="true" /></span></div>
          <div className="grid grid-cols-4 gap-3">{(['fifty', 'swap', 'phone', 'audience'] as Lifeline[]).map(type => <button key={type} className={`lifeline-tile focus-ring ${lifelineUses[type] ? 'paid' : ''}`} onClick={() => triggerLifeline(type)}><span>{type === 'fifty' ? <Percent size={18} aria-hidden="true" /> : type === 'swap' ? <RefreshCw size={18} aria-hidden="true" /> : type === 'phone' ? <Phone size={18} aria-hidden="true" /> : <Users size={18} aria-hidden="true" />}</span><span>{t[type]}</span><small>{lifelineUses[type] ? money(priceFor(type, currentPrize)) : t.free}</small></button>)}</div>
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
          <div>
            <p className="mb-4 w-fit rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold">Community Studio</p>
            <h1 className="text-4xl font-black md:text-6xl">{ui.submitTitle}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/68">{ui.submitIntro}</p>
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

function Result({ t, authUi, isAuthenticated, state, correctCount, elapsed, prize, start, home }: { t: Record<string, string>; authUi: Record<string, string>; isAuthenticated: boolean; state: EndState; correctCount: number; elapsed: number; prize: number; start: () => void; home: () => void }) {
  const title = state === 'win' ? t.winTitle : state === 'quit' ? t.quitTitle : state === 'timeout' ? t.timeoutTitle : t.lostTitle;
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <section className="mx-auto grid min-h-[calc(100vh-104px)] max-w-5xl place-items-center px-6 pb-14">
      <div className="glass w-full rounded-[34px] p-8 text-center md:p-12">
        <div className="mx-auto mb-5 text-7xl text-gold"><Trophy size={56} aria-hidden="true" /></div>
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

function Leaderboard({ t, entries, status, nickname, authUi, setNickname, bestPrize }: {
  t: Record<string, string>;
  entries: LeaderboardEntry[];
  status: LeaderboardStatus;
  nickname: string;
  locale: Locale;
  authUi: Record<string, string>;
  setNickname: (value: string) => void | Promise<void>;
  bestPrize: number;
}) {
  const [draft, setDraft] = useState(nickname);

  useEffect(() => {
    setDraft(nickname);
  }, [nickname]);

  const validation = validateNickname(draft, authUi);
  const message = status === 'loading' || status === 'saving'
    ? t.lbLoading
    : status === 'saved'
      ? t.lbSaved
      : status === 'taken'
        ? t.lbTaken
        : status === 'error'
          ? t.lbError
          : '';

  return (
    <Panel title={t.lbTitle} icon={<Star size={26} aria-hidden="true" />}>
      <div className="leaderboard-layout">
        <section className="leaderboard-profile-card">
          <p className="leaderboard-eyebrow">{t.lbSubtitle}</p>
          <div className="leaderboard-personal-best">
            <span>{t.lbYourBest}</span>
            <strong>{money(bestPrize)}</strong>
          </div>
          <Field label={t.lbNickname}>
            <input
              className="form-input"
              value={draft}
              maxLength={20}
              onChange={event => setDraft(event.target.value)}
              placeholder={t.lbNickname}
              aria-invalid={draft.length > 0 && !validation.ok}
            />
          </Field>
          <p className={validation.ok ? 'nickname-live-message valid' : 'nickname-live-message invalid'} aria-live="polite">
            {draft.trim() ? validation.message : authUi.nicknamePrompt}
          </p>
          <p className="leaderboard-hint">{t.lbNicknameHint}</p>
          <button
            className="premium-button focus-ring w-full"
            disabled={status === 'saving' || !validation.ok}
            onClick={() => void setNickname(draft)}
          >
            {t.lbSave}
          </button>
          {message && <div className={`leaderboard-message ${status}`} aria-live="polite">{message}</div>}
        </section>

        <section className="leaderboard-table-card">
          {entries.length === 0 && <p className="leaderboard-empty">{status === 'loading' ? t.lbLoading : t.lbEmpty}</p>}
          {entries.length > 0 && (
            <div className="leaderboard-list" role="table" aria-label={t.lbTitle}>
              <div className="leaderboard-row leaderboard-head" role="row">
                <span role="columnheader">{t.lbRank}</span>
                <span role="columnheader">{t.lbPlayer}</span>
                <span role="columnheader">{t.lbBest}</span>
              </div>
              {entries.map((entry, index) => (
                <div key={entry.id} className="leaderboard-row" role="row">
                  <span className="leaderboard-rank" role="cell">{index + 1}</span>
                  <strong role="cell">{entry.nickname || entry.displayName}</strong>
                  <span className="leaderboard-prize" role="cell">{money(entry.bestPrize)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Panel>
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
          <div className="mt-3 grid grid-cols-2 gap-3"><button className="ghost-button focus-ring" onClick={importQuestions}>{t.importBtn}</button><button className="ghost-button focus-ring" onClick={exportQuestions}>{t.exportBtn}</button></div>
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
                  <div className="flex gap-2"><button className="ghost-button focus-ring" onClick={() => { setForm(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t.editBtn}</button><button className="ghost-button focus-ring" onClick={() => setExtraQuestions(previous => [{ ...item, id: `copy-${Date.now()}`, question: `${item.question} (עותק)` }, ...previous])}>{t.dupBtn}</button><button className="ghost-button focus-ring" onClick={() => setExtraQuestions(previous => previous.filter(question => question.id !== item.id))}>{t.delBtn}</button></div>
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
      <button className="premium-button focus-ring w-full" onClick={save}>{t.saveQuestion}</button>
      <button className="ghost-button focus-ring w-full" onClick={reset}>{t.clearForm}</button>
    </div>
  );
}

function GameExitModal({ t, stay, leave }: { t: Record<string, string>; stay: () => void; leave: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') stay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stay]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="exit-title">
      <div className="glass modal-card">
        <div className="text-4xl text-gold" aria-hidden="true"><HomeIcon size={34} /></div>
        <h3 id="exit-title">{t.exitTitle}</h3>
        <p>{t.exitBody}</p>
        <div className="mt-5 flex gap-3">
          <button className="premium-button focus-ring flex-1" type="button" autoFocus onClick={stay}>{t.exitStay}</button>
          <button className="ghost-button focus-ring flex-1" type="button" onClick={leave}>{t.exitLeave}</button>
        </div>
      </div>
    </div>
  );
}

function PaidModal({ t, pending, pot, cancel, confirm }: { t: Record<string, string>; pending: { type: Lifeline; price: number }; pot: number; cancel: () => void; confirm: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="paid-title">
      <div className="glass modal-card">
        <div className="text-4xl text-gold">$</div>
        <h3 id="paid-title">{t.paidTitle}</h3>
        <p>{fmt(t.paidBody, { label: t[pending.type], price: money(pending.price) })}</p>
        <div className="rounded-2xl bg-white/[0.07] p-4 text-sm text-white/65">{fmt(t.paidPotInfo, { pot: money(pot) })}</div>
        <div className="mt-5 flex gap-3"><button className="premium-button focus-ring flex-1" onClick={confirm}>{t.confirmPay}</button><button className="ghost-button focus-ring flex-1" onClick={cancel}>{t.cancelBtn}</button></div>
      </div>
    </div>
  );
}

function Contact({ t, sent, setSent }: { t: Record<string, string>; sent: boolean; setSent: (value: boolean) => void }) {
  return <Panel title={t.contact} icon={<Mail size={26} aria-hidden="true" />}><div className="grid gap-4"><Field label={t.fullName}><input className="form-input" /></Field><Field label={t.email}><input className="form-input" type="email" /></Field><Field label={t.message}><textarea className="form-input min-h-36" /></Field><button className="premium-button focus-ring" onClick={() => setSent(true)}>{t.sendMsg}</button>{sent && <Success text={t.contactSuccess} />}</div></Panel>;
}

const ACHIEVEMENT_KEYS: Record<string, string> = {
  'כניסה לאולפן': 'achStudio',
  'מיליון דולר': 'achMillion',
  'שחקן בכיר': 'achSenior',
  'משחק הושלם': 'achDone'
};

function Profile({ t, stats }: { t: Record<string, string>; stats: Stats }) {
  return <Panel title={t.profile} icon={<Star size={26} aria-hidden="true" />}><div className="grid gap-4 md:grid-cols-3"><Metric value={String(stats.games)} label={t.gamesPlayed} /><Metric value={money(stats.bestPrize)} label={t.bestWin} gold /><Metric value={String(stats.correct)} label={t.correctTotal} /><Metric value={money(stats.totalMoney)} label={t.moneyTotal} gold /><Metric value={String(stats.lifelines)} label={t.lifelinesUsed} /><Metric value={String(stats.achievements.length)} label={t.achievementsLbl} /></div><div className="mt-6 rounded-3xl border border-white/12 bg-white/[0.07] p-5"><h3 className="mb-3 text-xl font-black">{t.achievementsLbl}</h3><div className="flex flex-wrap gap-3">{stats.achievements.map(item => <span key={item} className="rounded-full bg-gold/15 px-4 py-2 text-sm font-bold text-gold">{ACHIEVEMENT_KEYS[item] ? t[ACHIEVEMENT_KEYS[item]] : item}</span>)}</div></div></Panel>;
}

function PremiumProfile({ t, authUi, user, nickname, stats }: { t: Record<string, string>; authUi: Record<string, string>; user: PublicAuthUser | null; nickname: string; stats: Stats }) {
  const displayName = nickname || user?.displayName || user?.email?.split('@')[0] || authUi.notSignedIn;
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';
  const highestCorrect = Math.min(15, stats.correct);
  const winRate = stats.games > 0 && stats.bestPrize >= 1000000 ? `${Math.round((1 / stats.games) * 100)}%` : '0%';

  return (
    <Panel title={t.profile} icon="ג˜…">
      <section className="profile-hero-card">
        {user?.avatarUrl ? <img className="profile-avatar" src={user.avatarUrl} alt="" /> : <span className="profile-avatar" aria-hidden="true">{initialsFor(displayName)}</span>}
        <div>
          <p>{authUi.account}</p>
          <h3>{displayName}</h3>
          <span>{nickname || authUi.chooseNickname}</span>
        </div>
      </section>
      <div className="profile-metrics-grid">
        <Metric value={nickname || '—'} label={authUi.nicknamePlaceholder} />
        <Metric value={displayName} label="Display Name" />
        <Metric value={user?.email || '—'} label={authUi.privateEmail} />
        <Metric value={String(stats.games)} label={t.gamesPlayed} />
        <Metric value={money(stats.bestPrize)} label={t.bestWin} gold />
        <Metric value={String(highestCorrect)} label={authUi.stats} />
        <Metric value="0" label={authUi.multiplayerWins} />
        <Metric value={winRate} label={authUi.winRate} />
        <Metric value="—" label={authUi.favoriteCategory} />
        <Metric value={memberSince} label={authUi.memberSince} />
        <Metric value={money(stats.totalMoney)} label={t.moneyTotal} gold />
        <Metric value={String(stats.lifelines)} label={t.lifelinesUsed} />
      </div>
      <div className="profile-achievements-card">
        <h3>{t.achievementsLbl}</h3>
        <div>{stats.achievements.map(item => <span key={item}>{ACHIEVEMENT_KEYS[item] ? t[ACHIEVEMENT_KEYS[item]] : item}</span>)}</div>
        <p>{authUi.achievements}</p>
      </div>
    </Panel>
  );
}

function SettingsPanel({ t, settings, setSettings, reset }: { t: Record<string, string>; settings: Settings; setSettings: (settings: Settings | ((settings: Settings) => Settings)) => void; reset: () => void }) {
  const timerOptions = [
    { value: 'רגועה', label: t.timerCalm },
    { value: 'דרמטית', label: t.timerDramatic },
    { value: 'אינטנסיבית', label: t.timerIntense }
  ];
  return <Panel title={t.settings} icon={<SettingsIcon size={26} aria-hidden="true" />}><div className="grid gap-4"><label className="setting-row"><span>{t.soundLbl}</span><input type="checkbox" checked={settings.sound} onChange={event => setSettings(value => ({ ...value, sound: event.target.checked }))} /></label><label className="setting-row"><span>{t.effectsLbl}</span><input type="checkbox" checked={settings.effects} onChange={event => setSettings(value => ({ ...value, effects: event.target.checked }))} /></label><Field label={t.timerLbl}><select className="form-input" value={settings.timer} onChange={event => setSettings(value => ({ ...value, timer: event.target.value }))}>{timerOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><button className="ghost-button focus-ring" onClick={reset}>{t.resetData}</button></div></Panel>;
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

function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(item => item[0])
    .join('')
    .toUpperCase() || 'U';
}

function validateNickname(value: string, ui: Record<string, string>) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 3) return { ok: false, message: ui.nicknameShort };
  if (cleaned.length > 20) return { ok: false, message: ui.nicknameLong };
  if (!/^[\p{L}\p{N} _.-]+$/u.test(cleaned)) return { ok: false, message: ui.nicknameChars };
  if (RESERVED_NICKNAMES.has(cleaned.toLowerCase())) return { ok: false, message: ui.nicknameReserved };
  return { ok: true, message: ui.nicknameValid };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="mx-auto max-w-5xl px-5 pb-16 pt-8"><div className="glass rounded-[34px] p-6 md:p-10"><div className="mb-7 flex items-center gap-4 text-gold"><span className="text-4xl">{icon}</span><h2 className="text-4xl font-black text-white md:text-5xl">{title}</h2></div>{children}</div></section>;
}

function Metric({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return <div className="rounded-3xl bg-white/[0.08] p-5"><div className={`mt-2 text-3xl font-black ${gold ? 'text-gold' : 'text-azure'}`}>{value}</div><div className="text-white/55">{label}</div></div>;
}

function Success({ text }: { text: string }) {
  return <div className="rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 font-bold text-emerald-100">{text}</div>;
}
