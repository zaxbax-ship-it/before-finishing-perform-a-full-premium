import type { Locale, QuestionTranslation } from './types';
import type { LocaleResources } from './localization/types';
import HE from './localization/locales/he';

/**
 * Localization engine facade.
 *
 * The translation data now lives in per-locale modules under
 * ./localization/locales — the client bundle carries only Hebrew (the base and
 * fallback language); every other locale is code-split and fetched on demand
 * via {@link ensureLocaleResources}. All exported functions keep their original
 * synchronous signatures and, once a locale's resources are loaded, return
 * byte-for-byte the same output as the former monolithic dictionary (verified
 * by a golden-output equivalence test at migration time).
 *
 * Until a locale finishes loading, lookups fall back to the Hebrew resources —
 * callers that switch languages should await ensureLocaleResources(locale)
 * before rendering with the new locale (the app shell does this).
 */
const registry: Partial<Record<Locale, LocaleResources>> = { he: HE };

const loaders: Record<Locale, () => Promise<{ default: LocaleResources }>> = {
  he: () => import('./localization/locales/he'),
  en: () => import('./localization/locales/en'),
  ar: () => import('./localization/locales/ar'),
  ru: () => import('./localization/locales/ru'),
  am: () => import('./localization/locales/am')
};

const pendingLoads: Partial<Record<Locale, Promise<void>>> = {};

/** Loads (and caches) the resources for a locale. Safe to call repeatedly. */
export function ensureLocaleResources(locale: Locale): Promise<void> {
  if (registry[locale]) return Promise.resolve();
  const existing = pendingLoads[locale];
  if (existing) return existing;
  const load = loaders[locale]()
    .then(module => { registry[locale] = module.default; })
    .catch(() => { delete pendingLoads[locale]; /* keep Hebrew fallback; retry on next call */ });
  pendingLoads[locale] = load;
  return load;
}

/** True once a locale's resources are loaded (Hebrew is always ready). */
export function isLocaleResourcesReady(locale: Locale): boolean {
  return Boolean(registry[locale]);
}

function res(locale: Locale): LocaleResources {
  return registry[locale] || HE;
}

/**
 * Read accessor for the active locale's resources (Hebrew fallback until the
 * locale finishes loading). Used by the UI-copy facades so every per-language
 * string ships in exactly one place: the locale's own resource module.
 */
export function getLocaleResources(locale: Locale): LocaleResources {
  return res(locale);
}

function splitPrefix(value: string) {
  for (const p of HE.prefix.slice(1)) {
    if (value.startsWith(p)) return { lead: p, body: value.slice(p.length) };
  }
  return { lead: '', body: value };
}

function t(locale: Locale, value: string) {
  return res(locale).manual[value] || res(locale).extraTerm[value] || res(locale).term[value] || value;
}

function translateQuestionText(locale: Locale, text: string) {
  if (locale === 'he') return text;
  const { lead, body } = splitPrefix(text);
  const leadIndex = HE.prefix.indexOf(lead);
  const translatedLead = res(locale).prefix[leadIndex >= 0 ? leadIndex : 0] || '';
  let match = body.match(/^מהי בירת (.+)\?$/u);
  if (match) return `${translatedLead}${locale === 'en' ? `What is the capital of ${t(locale, match[1])}?` : locale === 'ar' ? `ما عاصمة ${t(locale, match[1])}؟` : locale === 'ru' ? `Какова столица страны ${t(locale, match[1])}?` : `የ${t(locale, match[1])} ዋና ከተማ ምንድነው?`}`;
  match = body.match(/^באיזו יבשת נמצאת (.+)\?$/u);
  if (match) return `${translatedLead}${locale === 'en' ? `On which continent is ${t(locale, match[1])}?` : locale === 'ar' ? `في أي قارة تقع ${t(locale, match[1])}؟` : locale === 'ru' ? `На каком континенте находится ${t(locale, match[1])}?` : `${t(locale, match[1])} በየትኛው አህጉር ነው?`}`;
  match = body.match(/^מהו (.+?)(?: \(גרסה (\d+)\))?\?$/u) || body.match(/^מהי (.+?)(?: \(גרסה (\d+)\))?\?$/u);
  if (match) {
    const subject = t(locale, match[1]);
    const version = match[2] ? (locale === 'en' ? ` version ${match[2]}` : locale === 'ar' ? ` النسخة ${match[2]}` : locale === 'ru' ? ` версия ${match[2]}` : ` ስሪት ${match[2]}`) : '';
    return `${translatedLead}${locale === 'en' ? `What is ${subject}${version}?` : locale === 'ar' ? `ما هو ${subject}${version}؟` : locale === 'ru' ? `Что такое ${subject}${version}?` : `${subject}${version} ምንድነው?`}`;
  }
  return translatedLead + (res(locale).exactQuestion[body] || body);
}

function splitCleanPrefix(value: string) {
  for (const item of HE.cleanPrefix.slice(1)) {
    if (value.startsWith(item)) return { prefixIndex: HE.cleanPrefix.indexOf(item), body: value.slice(item.length) };
  }
  return { prefixIndex: 0, body: value };
}

function versionText(locale: Locale, version?: string) {
  if (!version) return '';
  if (locale === 'en') return ` version ${version}`;
  if (locale === 'ar') return ` النسخة ${version}`;
  if (locale === 'ru') return ` версия ${version}`;
  return ` ስሪት ${version}`;
}

function questionTemplate(locale: Locale, kind: 'what' | 'abbrev' | 'role' | 'does' | 'whoWas' | 'represent', subject: string, version?: string) {
  const item = t(locale, subject);
  const versionPart = versionText(locale, version);
  if (kind === 'abbrev') {
    if (locale === 'en') return `What does the abbreviation ${item}${versionPart} mean?`;
    if (locale === 'ar') return `ماذا يعني الاختصار ${item}${versionPart}؟`;
    if (locale === 'ru') return `Что означает сокращение ${item}${versionPart}?`;
    return `${item}${versionPart} ምህጻረ ቃል ምን ማለት ነው?`;
  }
  if (kind === 'role') {
    if (locale === 'en') return `What is the role of ${item}${versionPart}?`;
    if (locale === 'ar') return `ما وظيفة ${item}${versionPart}؟`;
    if (locale === 'ru') return `Какова роль ${item}${versionPart}?`;
    return `${item}${versionPart} ሚናው ምንድነው?`;
  }
  if (kind === 'does') {
    if (locale === 'en') return `What does ${item}${versionPart} do?`;
    if (locale === 'ar') return `ماذا يفعل ${item}${versionPart}؟`;
    if (locale === 'ru') return `Что делает ${item}${versionPart}?`;
    return `${item}${versionPart} ምን ያደርጋል?`;
  }
  if (kind === 'whoWas') {
    if (locale === 'en') return `Who was ${item}${versionPart}?`;
    if (locale === 'ar') return `من كان ${item}${versionPart}؟`;
    if (locale === 'ru') return `Кем был ${item}${versionPart}?`;
    return `${item}${versionPart} ማን ነበር?`;
  }
  if (kind === 'represent') {
    if (locale === 'en') return `What does ${item}${versionPart} represent?`;
    if (locale === 'ar') return `ماذا يرمز ${item}${versionPart}؟`;
    if (locale === 'ru') return `Что обозначает ${item}${versionPart}?`;
    return `${item}${versionPart} ምንን ይወክላል?`;
  }
  if (locale === 'en') return `What is ${item}${versionPart}?`;
  if (locale === 'ar') return `ما هو ${item}${versionPart}؟`;
  if (locale === 'ru') return `Что такое ${item}${versionPart}?`;
  return `${item}${versionPart} ምንድነው?`;
}

function enhancedTranslateQuestionText(locale: Locale, text: string) {
  if (locale === 'he') return text;
  const { prefixIndex, body } = splitCleanPrefix(text);
  const lead = res(locale).cleanPrefix[prefixIndex] || '';
  const manual = res(locale).manual[body];
  if (manual) return lead + manual;
  const original = translateQuestionText(locale, text);
  if (!/[א-ת]/u.test(original)) return original;
  let match = body.match(/^מה(?:ו|י) (.+?)(?: \(גרסה (\d+)\))?\?$/u);
  if (match) return lead + questionTemplate(locale, 'what', match[1], match[2]);
  match = body.match(/^מה פירוש הקיצור (.+?)(?: \(גרסה (\d+)\))?\?$/u);
  if (match) return lead + questionTemplate(locale, 'abbrev', match[1], match[2]);
  match = body.match(/^מה תפקיד (.+?)(?: במחשב)?(?: \(גרסה (\d+)\))?\?$/u);
  if (match) return lead + questionTemplate(locale, 'role', match[1], match[2]);
  match = body.match(/^מה עושה (.+?)(?: \(גרסה (\d+)\))?\?$/u);
  if (match) return lead + questionTemplate(locale, 'does', match[1], match[2]);
  match = body.match(/^מי היה (.+?)(?: \(גרסה (\d+)\))?\?$/u);
  if (match) return lead + questionTemplate(locale, 'whoWas', match[1], match[2]);
  match = body.match(/^מה מסמל (.+?)(?: \(גרסה (\d+)\))?\?$/u);
  if (match) return lead + questionTemplate(locale, 'represent', match[1], match[2]);
  return original;
}

function localizedExplanation(locale: Locale, explanation: string | undefined, correctAnswer: string | undefined) {
  if (locale === 'he') return explanation;
  if (explanation && !/[א-ת]/u.test(explanation)) return explanation;
  const answer = correctAnswer || '';
  if (locale === 'en') return `The correct answer is ${answer}. This short note gives the key fact behind the question and helps you remember it for the next round.`;
  if (locale === 'ar') return `الإجابة الصحيحة هي ${answer}. هذه المعلومة القصيرة توضح الفكرة الأساسية وراء السؤال وتساعدك على تذكرها في الجولة التالية.`;
  if (locale === 'ru') return `Правильный ответ: ${answer}. Это короткое пояснение раскрывает главный факт вопроса и помогает запомнить его для следующего раунда.`;
  return `ትክክለኛው መልስ ${answer} ነው። ይህ አጭር ማብራሪያ የጥያቄውን ዋና እውነታ ያብራራል እና ለቀጣዩ ዙር እንዲታወስ ይረዳል።`;
}

export function localizeQuestion<T extends { category: string; difficulty: string; question: string; options?: string[]; answers?: string[]; correctAnswer?: string; explanation?: string; translations?: Partial<Record<Locale, QuestionTranslation>> }>(question: T, locale: Locale) {
  const override = question.translations?.[locale];
  const options = question.options || question.answers || [];
  if (locale === 'he') {
    return { ...question, category: question.category, difficulty: question.difficulty, question: question.question, options, answers: options };
  }
  const localizedOptions = override?.options || options.map(option => t(locale, option));
  const localizedCorrectAnswer = override?.correctAnswer || (question.correctAnswer ? t(locale, question.correctAnswer) : undefined);
  return {
    ...question,
    category: override?.category || res(locale).cleanCategory[question.category] || res(locale).category[question.category] || question.category,
    difficulty: override?.difficulty || res(locale).cleanDifficulty[question.difficulty] || res(locale).difficulty[question.difficulty] || question.difficulty,
    question: override?.question || enhancedTranslateQuestionText(locale, question.question),
    options: localizedOptions,
    answers: localizedOptions,
    correctAnswer: localizedCorrectAnswer,
    explanation: override?.explanation || localizedExplanation(locale, question.explanation, localizedCorrectAnswer)
  };
}

export function localizeCategory(locale: Locale, value: string) {
  return res(locale).cleanCategory[value] || res(locale).category[value] || value;
}

export function localizeDifficulty(locale: Locale, value: string) {
  return res(locale).cleanDifficulty[value] || res(locale).difficulty[value] || value;
}

export function localizeCategoryDescription(locale: Locale, value: string) {
  return res(locale).cleanCategoryDescription[value] || res(locale).categoryDescription[value] || HE.categoryDescription[value] || 'מאגר שאלות מאוזן';
}
