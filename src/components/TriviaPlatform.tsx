'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdSlot, GameplayAdSlot } from '@/components/ads/AdSlot';
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
import type { Locale, Question } from '@/lib/types';

type GameQuestion = Question & { answers: string[]; imageUrl?: string };
type Screen = 'home' | 'categories' | 'rules' | 'game' | 'result' | 'admin' | 'contact' | 'add' | 'profile' | 'settings' | 'submit';
type EndState = 'win' | 'quit' | 'timeout' | 'lost';
type Lifeline = 'fifty' | 'swap' | 'phone' | 'audience';

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
const STATS_KEY = 'premium-trivia-stats-v3';
const SETTINGS_KEY = 'premium-trivia-settings-v3';
const EXTRA_KEY = 'premium-trivia-extra-questions-v3';
const COMMUNITY_KEY = 'premium-trivia-community-submissions-v1';
const AUDIT_KEY = 'premium-trivia-audit-log-v1';

const UI: Record<Locale, Record<string, string>> = {
  he: {
    rules: 'איך משחקים',
    admin: 'ניהול שאלות',
    start: 'התחלת משחק',
    headline: 'משחק השעשועון',
    subtitle: 'טריוויה עברית יוקרתית',
    pill: 'חוויית שעשועון פרימיום בעברית מלאה',
    intro: 'מסע טריוויה דרמטי עם 15 שאלות, שלוש הזדמנויות, קופה חיה, גלגלי הצלה אסטרטגיים וסולם זכייה נוצץ.',
    enter: 'כניסה לאולפן',
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
    enter: 'Enter the Studio',
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
    enter: 'دخول الاستوديو',
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
    enter: 'Войти в студию',
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
    enter: 'ወደ ስቱዲዮ ግባ',
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
    achMillion: 'מיליון שקלים',
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
    diffExpert: 'מומחה'
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
    achMillion: 'One Million Shekels',
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
    diffExpert: 'Expert'
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
    achMillion: 'مليون شيكل',
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
    diffExpert: 'خبير'
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
    achMillion: 'Миллион шекелей',
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
    diffExpert: 'Эксперт'
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
    achMillion: 'አንድ ሚሊዮን ሼቄል',
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
    diffExpert: 'ባለሙያ'
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
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
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

const INFO_UI: Record<Locale, { correct: string; wrong: string; answer: string; next: string }> = {
  he: { correct: 'תשובה נכונה', wrong: 'כמעט. הנה ההסבר', answer: 'התשובה הנכונה', next: 'ממשיכים מיד לשאלה הבאה' },
  en: { correct: 'Correct answer', wrong: 'Almost. Here is the insight', answer: 'Correct answer', next: 'The next question starts in a moment' },
  ar: { correct: 'إجابة صحيحة', wrong: 'قريب. إليك التوضيح', answer: 'الإجابة الصحيحة', next: 'السؤال التالي سيبدأ بعد لحظة' },
  ru: { correct: 'Правильный ответ', wrong: 'Почти. Вот пояснение', answer: 'Правильный ответ', next: 'Следующий вопрос начнется через мгновение' },
  am: { correct: 'ትክክለኛ መልስ', wrong: 'ቅርብ ነበር። ማብራሪያው ይህ ነው', answer: 'ትክክለኛው መልስ', next: 'ቀጣዩ ጥያቄ በቅርቡ ይጀምራል' }
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

export default function TriviaPlatform({ questions, initialScreen = 'home' }: { questions: Question[]; initialScreen?: Screen }) {
  const baseQuestions = useMemo(() => questions.map(normalize), [questions]);
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

  const t = { ...UI[locale], ...UI_EXT[locale] };
  const communityT = COMMUNITY_UI[locale] || COMMUNITY_UI.he;
  const dir = locale === 'he' || locale === 'ar' ? 'rtl' : 'ltr';
  const allQuestions = useMemo(() => [...extraQuestions, ...baseQuestions], [extraQuestions, baseQuestions]);
  const categories = useMemo(() => Array.from(new Set(allQuestions.map(question => question.category))).sort(), [allQuestions]);
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
    setSettings(readLocal(SETTINGS_KEY, { sound: true, effects: true, timer: 'דרמטית' }));
    setStats(readLocal(STATS_KEY, { games: 0, bestPrize: 0, totalMoney: 0, correct: 0, lifelines: 0, achievements: ['כניסה לאולפן'] }));
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  function open(next: Screen) {
    setScreen(next);
    tone('click', settings.sound);
  }

  function startGame(nextCategory = category) {
    const available = shuffle(allQuestions.filter(question => nextCategory === 'הכול' || question.category === nextCategory));
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

  function chooseAnswer(index: number) {
    if (!current || selected !== null) return;
    setSelected(index);
    const correct = index === current.correctIndex;
    tone(correct ? 'correct' : 'wrong', settings.sound);
    window.setTimeout(() => {
      if (correct) nextQuestion();
      else loseChance('lost');
    }, 3200);
  }

  function loseChance(reason: EndState) {
    if (reason === 'timeout') tone('timeout', settings.sound);
    if (chances > 1) {
      setChances(value => value - 1);
      setNotice(reason === 'timeout' ? t.timeoutNotice : t.wrongNotice);
      window.setTimeout(nextQuestion, 3200);
      return;
    }
    finish(reason, guaranteedPrize);
  }

  function finish(state: EndState, prize: number) {
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
      achievements: Array.from(new Set([...previous.achievements, prize >= 1000000 ? 'מיליון שקלים' : prize >= 250000 ? 'שחקן בכיר' : 'משחק הושלם']))
    }));
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
      const replacement = shuffle(allQuestions.filter(question => question.category === gameSet[round].category && !usedIds.has(question.id)))[0];
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
    <main className={`app-shell font-hebrew premium-typography ${screen === 'game' ? 'game-active' : ''}`} dir={dir}>
      {settings.effects && <Particles />}
      <Header t={t} locale={locale} setLocale={setLocale} open={open} start={() => open('categories')} />
      {screen === 'home' && <Home t={t} start={() => open('categories')} admin={() => open('admin')} />}
      {screen === 'categories' && <Categories t={t} locale={locale} categories={categories} questions={allQuestions} startGame={startGame} />}
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
          triggerLifeline={triggerLifeline}
          quit={() => finish('quit', currentPrize || guaranteedPrize)}
        />
      )}
      {screen === 'result' && <Result t={t} state={endState} correctCount={round} elapsed={elapsed} prize={finalPrize} start={() => open('categories')} home={() => open('home')} />}
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
      {screen === 'add' && <Panel title={t.add} icon="✎"><QuestionForm t={t} locale={locale} form={form} setForm={setForm} save={saveQuestion} reset={() => setForm(emptyQuestion())} />{sent && <Success text={t.addSaved} />}</Panel>}
      {screen === 'profile' && <Profile t={t} stats={stats} />}
      {screen === 'settings' && <SettingsPanel t={t} settings={settings} setSettings={setSettings} reset={() => { localStorage.clear(); location.reload(); }} />}
      {pendingPaid && <PaidModal t={t} pending={pendingPaid} pot={currentPrize} cancel={() => setPendingPaid(null)} confirm={() => applyLifeline(pendingPaid.type, pendingPaid.price)} />}
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

function Header({ t, locale, setLocale, open, start }: { t: Record<string, string>; locale: Locale; setLocale: (locale: Locale) => void; open: (screen: Screen) => void; start: () => void }) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-5 pt-5 md:flex-row md:items-center md:justify-between lg:px-8">
      <button className="focus-ring flex items-center gap-3 text-right" onClick={() => open('home')}>
        <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-gold text-royal shadow-gold">♕</span>
        <span><strong className="block text-xl font-black">{t.headline}</strong><small className="text-white/65">{t.subtitle}</small></span>
      </button>
      <nav className="flex flex-wrap items-center gap-3">
        <button className="ghost-button focus-ring" onClick={() => open('rules')}>{t.rules}</button>
        <button className="ghost-button focus-ring" onClick={() => open('admin')}>{t.admin}</button>
        <button className="ghost-button focus-ring" onClick={() => open('submit')}>{(COMMUNITY_UI[locale] || COMMUNITY_UI.he).submitNav}</button>
        <button className="ghost-button focus-ring" onClick={() => open('contact')}>{t.contact}</button>
        <button className="ghost-button focus-ring" onClick={() => open('profile')}>{t.profile}</button>
        <button className="ghost-button focus-ring" onClick={() => open('settings')}>{t.settings}</button>
        <LanguageMenu locale={locale} setLocale={setLocale} />
        <button className="premium-button focus-ring" onClick={start}>{t.start}</button>
      </nav>
    </header>
  );
}

function LanguageMenu({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  const active = LANGUAGE_OPTIONS.find(item => item.value === locale) || LANGUAGE_OPTIONS[0];
  return (
    <div className="language-menu">
      <button className="language-trigger focus-ring" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Language">
        <span>{active.native}</span>
        {active.label !== active.native && <small>{active.label}</small>}
      </button>
      {open && (
        <div className="language-panel glass">
          {LANGUAGE_OPTIONS.map(item => (
            <button
              key={item.value}
              type="button"
              className={item.value === locale ? 'language-option active' : 'language-option'}
              onClick={() => {
                setLocale(item.value);
                setOpen(false);
              }}
            >
              <span>{item.native}</span>
              {item.label !== item.native && <small>{item.label}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Home({ t, start, admin }: { t: Record<string, string>; start: () => void; admin: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <div className="grid min-h-[calc(100vh-104px)] items-center gap-12 lg:grid-cols-[.86fr_1fr]">
        <div className="glass relative min-h-[620px] overflow-hidden rounded-[36px] p-8">
          <div className="absolute inset-8 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid h-full place-items-center text-center">
            <div>
              <div className="mb-7 text-6xl text-gold drop-shadow-[0_0_26px_rgba(247,202,103,.55)]">🏆</div>
              <div className="text-6xl font-black md:text-7xl">{money(1000000)}</div>
              <p className="mt-8 text-white/65">{t.live}</p>
              <div className="mx-auto mt-8 h-2 w-80 rounded-full bg-gradient-to-l from-gold to-azure" />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="mb-8 w-fit rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold shadow-gold">✦ {t.pill}</p>
          <h1 className="text-6xl font-black leading-[.92] md:text-[112px]">{t.headline}</h1>
          <p className="mt-7 max-w-4xl text-2xl font-bold leading-9 text-white/78">{t.intro}</p>
          <div className="mt-9 flex flex-wrap gap-4">
            <button className="premium-button focus-ring text-lg" onClick={start}>{t.enter}</button>
            <button className="ghost-button focus-ring text-lg" onClick={admin}>{t.manage}</button>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <Metric value="+500" label={t.homeQuestions} />
            <Metric value="3" label={t.chancesLabel} />
            <Metric value={money(1000000)} label={t.homePrize} gold />
          </div>
        </div>
      </div>
      <AdSlot placement="homepage-hero-below" className="mt-4" />
      <AdSlot placement="homepage-content" className="mt-8" />
    </section>
  );
}

function Categories({ t, locale, categories, questions, startGame }: { t: Record<string, string>; locale: Locale; categories: string[]; questions: GameQuestion[]; startGame: (category: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-[1680px] px-5 pb-16 pt-8 lg:px-8">
      <p className="mb-8 mr-auto w-fit rounded-full border border-gold/35 bg-gold/10 px-5 py-3 text-gold">✦ {t.catPill}</p>
      <h1 className="max-w-5xl text-6xl font-black md:text-[86px]">{t.choose}</h1>
      <p className="mt-5 max-w-4xl text-xl leading-8 text-white/72">{t.chooseText}</p>
      <AdSlot placement="categories-top" className="mt-7" />
      <button className="ghost-button focus-ring mt-8 lg:min-w-56" onClick={() => startGame('הכול')}>{t.all}</button>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {categories.map(category => (
          <button key={category} className="category-card focus-ring glass rounded-[30px] p-6 text-right" onClick={() => startGame(category)}>
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">✦</span>
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
    <Panel title={t.rulesTitle} icon="§">
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
  triggerLifeline: (type: Lifeline) => void;
  quit: () => void;
}) {
  const { t, locale, current, round, order, selected, hiddenAnswers, timer, timerUrgency, progress, currentPrize, nextPrize, guaranteedPrize, chances, lifelineUses, advice, notice, chooseAnswer, triggerLifeline, quit } = props;
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
          <span className="game-topline-info">{t.question} {round + 1}/15 · {current.category}</span>
          <span className={`game-topline-timer ${timerUrgency}`}>◷ {timer}</span>
          <span className="game-topline-pot">{money(currentPrize)}</span>
        </div>
        {current.imageUrl && <img src={current.imageUrl} alt="תמונת שאלה" className="mb-6 max-h-72 w-full rounded-3xl object-cover" />}
        <h2 className="question-text mb-6 max-w-5xl text-3xl font-black leading-[1.22] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.12)] md:text-5xl">{current.question}</h2>
        <div className="answers-grid grid gap-4 md:grid-cols-2">
          {order.map((answerIndex, displayIndex) => {
            const state = selected === null ? '' : answerIndex === current.correctIndex ? 'correct' : selected === answerIndex ? 'wrong' : '';
            return (
              <button key={answerIndex} disabled={selected !== null || hiddenAnswers.includes(answerIndex)} onClick={() => chooseAnswer(answerIndex)} className={['answer-button focus-ring', state, hiddenAnswers.includes(answerIndex) ? 'hidden' : ''].join(' ')}>
                <span className="ml-3 inline-grid h-9 w-9 place-items-center rounded-full bg-white/12 text-gold font-black">{optionLetters[displayIndex]}</span>
                <span className="text-xl font-bold">{current.answers[answerIndex]}</span>
              </button>
            );
          })}
        </div>
        {answerInfo && (
          <div className={answerInfo.correct ? 'answer-info-card correct' : 'answer-info-card wrong'}>
            <div>
              <strong>{answerInfo.correct ? infoUi.correct : infoUi.wrong}</strong>
              <small>{infoUi.answer}: {answerInfo.answer}</small>
            </div>
            <p>{answerInfo.explanation}</p>
            <em>{infoUi.next}</em>
          </div>
        )}
        {advice && <div className="mt-6 rounded-3xl border border-azure/35 bg-azure/10 p-5 text-lg leading-8 text-white/82">{advice}</div>}
        {notice && <div className="mt-6 rounded-3xl border border-gold/40 bg-gold/10 p-5 text-lg leading-8 text-gold">{notice}</div>}
        <div className="game-meta-below mt-6 grid gap-4 xl:grid-cols-[1fr_auto_auto]">
          <div>
            <div className="text-sm font-bold text-gold">{t.question} {round + 1} {t.of} 15 · {current.category} · {current.difficulty}</div>
            <div className="mt-2 text-2xl font-extrabold">{t.currentPrize}: {money(nextPrize)}</div>
          </div>
          <div className="money-pot"><span>₪</span><div><small>{t.currentPot}</small><strong>{money(currentPrize)}</strong></div></div>
          <div className={`timer-badge ${timerUrgency}`}><span>◷</span><span>{timer}</span><small>{t.seconds}</small></div>
        </div>
        <div className="chance-row mt-4"><span>{t.chancesLabel}</span>{[0, 1, 2].map(index => <span key={index} className={index < chances ? 'text-ember' : 'text-white/22'}>♥</span>)}</div>
        <div className="mt-4 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-gold to-azure transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      </section>
      <aside className="space-y-5">
        <div className="glass rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-extrabold">{t.lifelines}</h3><span className="text-gold">✦</span></div>
          <div className="grid grid-cols-4 gap-3">{(['fifty', 'swap', 'phone', 'audience'] as Lifeline[]).map(type => <button key={type} className={`lifeline-tile focus-ring ${lifelineUses[type] ? 'paid' : ''}`} onClick={() => triggerLifeline(type)}><span>{type === 'fifty' ? '½' : type === 'swap' ? '↻' : type === 'phone' ? '☎' : '◌'}</span><span>{t[type]}</span><small>{lifelineUses[type] ? money(priceFor(type, currentPrize)) : t.free}</small></button>)}</div>
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

function Result({ t, state, correctCount, elapsed, prize, start, home }: { t: Record<string, string>; state: EndState; correctCount: number; elapsed: number; prize: number; start: () => void; home: () => void }) {
  const title = state === 'win' ? t.winTitle : state === 'quit' ? t.quitTitle : state === 'timeout' ? t.timeoutTitle : t.lostTitle;
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <section className="mx-auto grid min-h-[calc(100vh-104px)] max-w-5xl place-items-center px-6 pb-14">
      <div className="glass w-full rounded-[34px] p-8 text-center md:p-12">
        <div className="mx-auto mb-5 text-7xl text-gold">🏆</div>
        <h2 className="text-5xl font-black">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-xl leading-8 text-white/70">{fmt(t.resultSummary, { correct: correctCount, time, prize: money(prize) })}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3"><Metric value={`${correctCount}/15`} label={t.accuracy} /><Metric value={`${elapsed}s`} label={t.timeLabel} /><Metric value={money(prize)} label={t.homePrize} gold /></div>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"><button className="premium-button focus-ring" onClick={start}>{t.playAgain}</button><button className="ghost-button focus-ring" onClick={() => navigator.share?.({ title: t.headline, text: fmt(t.shareText, { prize: money(prize) }) })}>{t.shareBtn}</button><button className="ghost-button focus-ring" onClick={home}>{t.home}</button></div>
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
        <div className="mb-6 flex items-center justify-between"><h2 className="text-3xl font-black">{t.manageTitle}</h2><span className="text-gold">⚙</span></div>
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

function PaidModal({ t, pending, pot, cancel, confirm }: { t: Record<string, string>; pending: { type: Lifeline; price: number }; pot: number; cancel: () => void; confirm: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="glass modal-card">
        <div className="text-4xl text-gold">₪</div>
        <h3>{t.paidTitle}</h3>
        <p>{fmt(t.paidBody, { label: t[pending.type], price: money(pending.price) })}</p>
        <div className="rounded-2xl bg-white/[0.07] p-4 text-sm text-white/65">{fmt(t.paidPotInfo, { pot: money(pot) })}</div>
        <div className="mt-5 flex gap-3"><button className="premium-button focus-ring flex-1" onClick={confirm}>{t.confirmPay}</button><button className="ghost-button focus-ring flex-1" onClick={cancel}>{t.cancelBtn}</button></div>
      </div>
    </div>
  );
}

function Contact({ t, sent, setSent }: { t: Record<string, string>; sent: boolean; setSent: (value: boolean) => void }) {
  return <Panel title={t.contact} icon="✉"><div className="grid gap-4"><Field label={t.fullName}><input className="form-input" /></Field><Field label={t.email}><input className="form-input" type="email" /></Field><Field label={t.message}><textarea className="form-input min-h-36" /></Field><button className="premium-button focus-ring" onClick={() => setSent(true)}>{t.sendMsg}</button>{sent && <Success text={t.contactSuccess} />}</div></Panel>;
}

const ACHIEVEMENT_KEYS: Record<string, string> = {
  'כניסה לאולפן': 'achStudio',
  'מיליון שקלים': 'achMillion',
  'שחקן בכיר': 'achSenior',
  'משחק הושלם': 'achDone'
};

function Profile({ t, stats }: { t: Record<string, string>; stats: Stats }) {
  return <Panel title={t.profile} icon="★"><div className="grid gap-4 md:grid-cols-3"><Metric value={String(stats.games)} label={t.gamesPlayed} /><Metric value={money(stats.bestPrize)} label={t.bestWin} gold /><Metric value={String(stats.correct)} label={t.correctTotal} /><Metric value={money(stats.totalMoney)} label={t.moneyTotal} gold /><Metric value={String(stats.lifelines)} label={t.lifelinesUsed} /><Metric value={String(stats.achievements.length)} label={t.achievementsLbl} /></div><div className="mt-6 rounded-3xl border border-white/12 bg-white/[0.07] p-5"><h3 className="mb-3 text-xl font-black">{t.achievementsLbl}</h3><div className="flex flex-wrap gap-3">{stats.achievements.map(item => <span key={item} className="rounded-full bg-gold/15 px-4 py-2 text-sm font-bold text-gold">{ACHIEVEMENT_KEYS[item] ? t[ACHIEVEMENT_KEYS[item]] : item}</span>)}</div></div></Panel>;
}

function SettingsPanel({ t, settings, setSettings, reset }: { t: Record<string, string>; settings: Settings; setSettings: (settings: Settings | ((settings: Settings) => Settings)) => void; reset: () => void }) {
  const timerOptions = [
    { value: 'רגועה', label: t.timerCalm },
    { value: 'דרמטית', label: t.timerDramatic },
    { value: 'אינטנסיבית', label: t.timerIntense }
  ];
  return <Panel title={t.settings} icon="⚙"><div className="grid gap-4"><label className="setting-row"><span>{t.soundLbl}</span><input type="checkbox" checked={settings.sound} onChange={event => setSettings(value => ({ ...value, sound: event.target.checked }))} /></label><label className="setting-row"><span>{t.effectsLbl}</span><input type="checkbox" checked={settings.effects} onChange={event => setSettings(value => ({ ...value, effects: event.target.checked }))} /></label><Field label={t.timerLbl}><select className="form-input" value={settings.timer} onChange={event => setSettings(value => ({ ...value, timer: event.target.value }))}>{timerOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><button className="ghost-button focus-ring" onClick={reset}>{t.resetData}</button></div></Panel>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>;
}

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return <section className="mx-auto max-w-5xl px-5 pb-16 pt-8"><div className="glass rounded-[34px] p-6 md:p-10"><div className="mb-7 flex items-center gap-4 text-gold"><span className="text-4xl">{icon}</span><h2 className="text-4xl font-black text-white md:text-5xl">{title}</h2></div>{children}</div></section>;
}

function Metric({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return <div className="rounded-3xl bg-white/[0.08] p-5"><div className={`mt-2 text-3xl font-black ${gold ? 'text-gold' : 'text-azure'}`}>{value}</div><div className="text-white/55">{label}</div></div>;
}

function Success({ text }: { text: string }) {
  return <div className="rounded-2xl border border-emerald-300/35 bg-emerald-300/10 p-4 font-bold text-emerald-100">{text}</div>;
}
