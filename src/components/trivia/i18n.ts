import type { Locale } from '@/lib/types';

/**
 * Community studio / moderation dashboard copy.
 *
 * Moved verbatim out of `TriviaPlatform.tsx` so it can be shared between the
 * public `Home` screen (submit-question nav label) and the orchestrator without
 * a circular import. Translations are unchanged.
 */
export const COMMUNITY_UI: Record<Locale, Record<string, string>> = {
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


/**
 * In-game answer-feedback copy (correct/wrong reveal). Moved verbatim from
 * `TriviaPlatform.tsx`; consumed by the gameplay screen.
 */
export const INFO_UI: Record<Locale, { correct: string; wrong: string; answer: string; next: string; action: string; imageAlt: string }> = {
  he: { correct: 'תשובה נכונה', wrong: 'כמעט. הנה ההסבר', answer: 'התשובה הנכונה', next: 'קראו את ההסבר והמשיכו כשתהיו מוכנים', action: 'לשאלה הבאה', imageAlt: 'תמונת שאלה' },
  en: { correct: 'Correct answer', wrong: 'Almost. Here is the insight', answer: 'Correct answer', next: 'Read the explanation and continue when you are ready', action: 'Next question', imageAlt: 'Question image' },
  ar: { correct: 'إجابة صحيحة', wrong: 'قريب. إليك التوضيح', answer: 'الإجابة الصحيحة', next: 'اقرأ التوضيح وتابع عندما تكون جاهزًا', action: 'السؤال التالي', imageAlt: 'صورة السؤال' },
  ru: { correct: 'Правильный ответ', wrong: 'Почти. Вот пояснение', answer: 'Правильный ответ', next: 'Прочитайте пояснение и продолжите, когда будете готовы', action: 'Следующий вопрос', imageAlt: 'Изображение вопроса' },
  am: { correct: 'ትክክለኛ መልስ', wrong: 'ቅርብ ነበር። ማብራሪያው ይህ ነው', answer: 'ትክክለኛው መልስ', next: 'ማብራሪያውን አንብበው ዝግጁ ሲሆኑ ይቀጥሉ', action: 'ቀጣዩ ጥያቄ', imageAlt: 'የጥያቄ ምስል' }
};

/**
 * Homepage marketing tile for the question bank. Intentionally non-numeric so it
 * stays accurate across every locale (no hard count to contradict). Shown as a
 * stat tile: `value` on top, `label` beneath.
 */
export const MARKETING_QUESTIONS: Record<Locale, { value: string; label: string }> = {
  he: { value: 'אינסוף', label: 'שאלות טריוויה' },
  en: { value: 'Endless', label: 'trivia questions' },
  ar: { value: 'لا نهائية', label: 'أسئلة المسابقات' },
  ru: { value: 'Бесконечно', label: 'вопросов викторины' },
  am: { value: 'ማለቂያ የሌለው', label: 'የእንቆቅልሽ ጥያቄዎች' }
};

/** Maps stored Hebrew achievement ids to their localized UI keys. */
export const ACHIEVEMENT_KEYS: Record<string, string> = {
  'כניסה לאולפן': 'achStudio',
  'מיליון דולר': 'achMillion',
  'שחקן בכיר': 'achSenior',
  'משחק הושלם': 'achDone'
};
