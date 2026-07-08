'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BackIcon,
  CloseIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  ExportIcon,
  ImportIcon,
  SearchIcon,
  SettingsIcon,
  ConfirmIcon
} from '@/lib/design/icons';
import { ensureLocaleResources, localizeCategory, localizeQuestion } from '@/lib/localization';
import type { Locale, Question } from '@/lib/types';

type AdminQuestion = Question & { answers: string[]; imageUrl?: string };

const LETTERS = ['א', 'ב', 'ג', 'ד'];
const OPTION_LETTERS: Record<Locale, string[]> = {
  he: LETTERS,
  en: ['A', 'B', 'C', 'D'],
  ar: ['أ', 'ب', 'ج', 'د'],
  ru: ['А', 'Б', 'В', 'Г'],
  am: ['ሀ', 'ለ', 'ሐ', 'መ']
};
const ADMIN_UI: Record<Locale, Record<string, string>> = {
  he: {
    correct: 'תשובה נכונה', edit: 'עריכה', duplicate: 'שכפול', delete: 'מחיקה', all: 'הכול',
    back: 'חזרה למשחק', sub: 'ניהול מאגר השאלות', title: 'מרכז בקרה פרימיום', available: 'שאלות זמינות',
    editTitle: 'עריכת שאלה', importExport: 'ייבוא וייצוא', importBtn: 'ייבוא', exportBtn: 'ייצוא', importFail: 'JSON לא תקין',
    pool: 'מאגר השאלות', poolCount: '{total} שאלות במערכת · {shown} מוצגות כרגע', searchPh: 'חיפוש שאלה, תשובה או תגית',
    catsLbl: 'קטגוריות', shownLbl: 'תוצאות מוצגות', rtlLbl: 'עברית מלאה', displayLang: 'שפת תצוגה',
    qLabel: 'שאלה', answerLbl: 'תשובה', correctOpt: 'נכונה', imageLink: 'קישור תמונה',
    saveQuestion: 'שמירת שאלה', clearForm: 'ניקוי טופס',
    diffEasy: 'קל', diffMedium: 'בינוני', diffHard: 'קשה', diffExpert: 'מומחה'
  },
  en: {
    correct: 'Correct answer', edit: 'Edit', duplicate: 'Duplicate', delete: 'Delete', all: 'All',
    back: 'Back to the Game', sub: 'Question Bank Management', title: 'Premium Control Center', available: 'available questions',
    editTitle: 'Edit Question', importExport: 'Import and Export', importBtn: 'Import', exportBtn: 'Export', importFail: 'Invalid JSON',
    pool: 'Question Bank', poolCount: '{total} questions in the system · {shown} currently shown', searchPh: 'Search a question, answer or tag',
    catsLbl: 'Categories', shownLbl: 'Results shown', rtlLbl: 'Full RTL support', displayLang: 'Display language',
    qLabel: 'Question', answerLbl: 'Answer', correctOpt: 'Correct', imageLink: 'Image link',
    saveQuestion: 'Save Question', clearForm: 'Clear Form',
    diffEasy: 'Easy', diffMedium: 'Medium', diffHard: 'Hard', diffExpert: 'Expert'
  },
  ar: {
    correct: 'الإجابة الصحيحة', edit: 'تعديل', duplicate: 'نسخ', delete: 'حذف', all: 'الكل',
    back: 'العودة إلى اللعبة', sub: 'إدارة بنك الأسئلة', title: 'مركز تحكم فاخر', available: 'أسئلة متاحة',
    editTitle: 'تعديل سؤال', importExport: 'استيراد وتصدير', importBtn: 'استيراد', exportBtn: 'تصدير', importFail: 'JSON غير صالح',
    pool: 'بنك الأسئلة', poolCount: '{total} سؤالا في النظام · {shown} معروضة الآن', searchPh: 'ابحث عن سؤال أو إجابة أو وسم',
    catsLbl: 'فئات', shownLbl: 'نتائج معروضة', rtlLbl: 'دعم كامل للكتابة من اليمين', displayLang: 'لغة العرض',
    qLabel: 'السؤال', answerLbl: 'إجابة', correctOpt: 'الصحيحة', imageLink: 'رابط صورة',
    saveQuestion: 'حفظ السؤال', clearForm: 'مسح النموذج',
    diffEasy: 'سهل', diffMedium: 'متوسط', diffHard: 'صعب', diffExpert: 'خبير'
  },
  ru: {
    correct: 'Правильный ответ', edit: 'Редактировать', duplicate: 'Дублировать', delete: 'Удалить', all: 'Все',
    back: 'Назад к игре', sub: 'Управление банком вопросов', title: 'Премиальный центр управления', available: 'доступных вопросов',
    editTitle: 'Редактирование вопроса', importExport: 'Импорт и экспорт', importBtn: 'Импорт', exportBtn: 'Экспорт', importFail: 'Некорректный JSON',
    pool: 'Банк вопросов', poolCount: '{total} вопросов в системе · {shown} показано сейчас', searchPh: 'Поиск вопроса, ответа или тега',
    catsLbl: 'Категории', shownLbl: 'Показано результатов', rtlLbl: 'Полная поддержка RTL', displayLang: 'Язык интерфейса',
    qLabel: 'Вопрос', answerLbl: 'Ответ', correctOpt: 'Верный', imageLink: 'Ссылка на изображение',
    saveQuestion: 'Сохранить вопрос', clearForm: 'Очистить форму',
    diffEasy: 'Легкий', diffMedium: 'Средний', diffHard: 'Сложный', diffExpert: 'Эксперт'
  },
  am: {
    correct: 'ትክክለኛ መልስ', edit: 'አርትዕ', duplicate: 'ቅዳ', delete: 'ሰርዝ', all: 'ሁሉም',
    back: 'ወደ ጨዋታው ተመለስ', sub: 'የጥያቄዎች ባንክ አስተዳደር', title: 'ፕሪሚየም መቆጣጠሪያ ማዕከል', available: 'ያሉ ጥያቄዎች',
    editTitle: 'ጥያቄ አርትዕ', importExport: 'ማስመጣት እና መላክ', importBtn: 'አስመጣ', exportBtn: 'ላክ', importFail: 'ልክ ያልሆነ JSON',
    pool: 'የጥያቄዎች ባንክ', poolCount: '{total} ጥያቄዎች በስርዓቱ · {shown} አሁን ይታያሉ', searchPh: 'ጥያቄ፣ መልስ ወይም መለያ ይፈልጉ',
    catsLbl: 'ምድቦች', shownLbl: 'የታዩ ውጤቶች', rtlLbl: 'ሙሉ የRTL ድጋፍ', displayLang: 'የማሳያ ቋንቋ',
    qLabel: 'ጥያቄ', answerLbl: 'መልስ', correctOpt: 'ትክክል', imageLink: 'የምስል አገናኝ',
    saveQuestion: 'ጥያቄ አስቀምጥ', clearForm: 'ቅጹን አጽዳ',
    diffEasy: 'ቀላል', diffMedium: 'መካከለኛ', diffHard: 'ከባድ', diffExpert: 'ባለሙያ'
  }
};

function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

function normalize(question: Question): AdminQuestion {
  const answers = question.options || (question as unknown as { answers?: string[] }).answers || [];
  return {
    ...question,
    answers,
    options: answers,
    question: String(question.question || '')
      .replace(/^שאלת ידע:\s*/u, '')
      .replace(/^בחרו את התשובה הנכונה:\s*/u, '')
      .replace(/^מהי התשובה המדויקת לשאלה הבאה:\s*/u, '')
      .replace(/^בשעשועון הידע:\s*/u, '')
      .trim()
  };
}

function emptyQuestion(): AdminQuestion {
  return {
    id: `admin-${Date.now()}`,
    category: 'ידע כללי',
    difficulty: 'בינוני',
    question: '',
    answers: ['', '', '', ''],
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  };
}

export default function AdminPanel({ questions }: { questions: Question[] }) {
  const baseQuestions = useMemo(() => questions.map(normalize), [questions]);
  const [localQuestions, setLocalQuestions] = useState<AdminQuestion[]>([]);
  const allQuestions = useMemo(() => [...localQuestions, ...baseQuestions], [baseQuestions, localQuestions]);
  const categories = useMemo(() => Array.from(new Set(allQuestions.map(question => question.category))).sort(), [allQuestions]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('הכול');
  const [difficulty, setDifficulty] = useState('הכול');
  const [locale, setLocale] = useState<Locale>('he');
  const ui = ADMIN_UI[locale];
  const [form, setForm] = useState<AdminQuestion>(emptyQuestion());
  const [importText, setImportText] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allQuestions.filter(question => {
      const matchesCategory = category === 'הכול' || question.category === category;
      const matchesDifficulty = difficulty === 'הכול' || question.difficulty === difficulty;
      const text = [question.question, question.category, question.difficulty, ...question.answers].join(' ').toLowerCase();
      return matchesCategory && matchesDifficulty && (!q || text.includes(q));
    }).slice(0, 450).map(question => localizeQuestion(question, locale));
  }, [allQuestions, category, difficulty, locale, query]);

  function saveQuestion() {
    const next = { ...form, options: form.answers, question: form.question.trim() };
    setLocalQuestions(previous => {
      const exists = previous.some(question => question.id === next.id);
      return exists ? previous.map(question => question.id === next.id ? next : question) : [next, ...previous];
    });
    setForm(emptyQuestion());
  }

  function importQuestions() {
    try {
      const parsed = JSON.parse(importText);
      const incoming = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(incoming)) return;
      setLocalQuestions(previous => [...incoming.map(normalize), ...previous]);
      setImportText('');
    } catch {
      setImportText(ui.importFail);
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

  const dir = locale === 'he' || locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <main className="app-shell font-hebrew premium-typography" dir={dir}>
      <div className="particles" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <span key={index} className="particle" style={{ right: `${(index * 37) % 100}%`, animationDelay: `${-(index * 1.5)}s`, ['--duration' as string]: `${24 + (index % 9)}s`, ['--opacity' as string]: `${0.25 + (index % 5) * 0.08}`, ['--x' as string]: `${index % 2 ? 70 : -70}px` }} />)}</div>
      <header className="relative z-20 mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-5 pt-5 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link className="ghost-button focus-ring inline-flex items-center gap-2" href="/"><BackIcon size={16} />{ui.back}</Link>
        <div className="text-right">
          <p className="text-gold">{ui.sub}</p>
          <h1 className="text-5xl font-black md:text-7xl">{ui.title}</h1>
          <span className="text-white/65">{allQuestions.length.toLocaleString('he-IL')} {ui.available}</span>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1680px] gap-6 px-5 pb-12 pt-8 lg:grid-cols-[430px_1fr] lg:px-8">
        <aside className="glass rounded-[30px] p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-black">{ui.editTitle}</h2>
            <span className="text-gold"><SettingsIcon size={18} aria-hidden="true" /></span>
          </div>
          <QuestionForm ui={ui} locale={locale} form={form} setForm={setForm} save={saveQuestion} reset={() => setForm(emptyQuestion())} />
          <div className="mt-7 border-t border-white/10 pt-6">
            <div className="mb-3 font-extrabold">{ui.importExport}</div>
            <textarea className="form-input min-h-28" value={importText} onChange={event => setImportText(event.target.value)} aria-label={ui.importExport} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2" onClick={importQuestions}><ImportIcon size={16} />{ui.importBtn}</button>
              <button className="ghost-button focus-ring inline-flex items-center justify-center gap-2" onClick={exportQuestions}><ExportIcon size={16} />{ui.exportBtn}</button>
            </div>
          </div>
        </aside>

        <section className="glass rounded-[30px] p-6">
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <h2 className="text-3xl font-black">{ui.pool}</h2>
              <p className="mt-1 text-white/58">{fmt(ui.poolCount, { total: allQuestions.length, shown: rows.length })}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="admin-search-shell sm:w-72">
                <SearchIcon size={16} aria-hidden="true" className="admin-search-icon" />
                <input className="form-input py-3 pl-4 pr-10 sm:w-72" value={query} onChange={event => setQuery(event.target.value)} placeholder={ui.searchPh} />
              </div>
              <select className="form-input" value={locale} onChange={event => { const next = event.target.value as Locale; void ensureLocaleResources(next).finally(() => setLocale(next)); }} aria-label={ui.displayLang}>
                <option value="he">עברית</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="ru">Русский</option>
                <option value="am">አማርኛ</option>
              </select>
              <select className="form-input" value={category} onChange={event => setCategory(event.target.value)}>
                <option value="הכול">{ui.all}</option>
                {categories.map(item => <option key={item} value={item}>{localizeCategory(locale, item)}</option>)}
              </select>
              <select className="form-input" value={difficulty} onChange={event => setDifficulty(event.target.value)}>
                <option value="הכול">{ui.all}</option>
                <option value="קל">{ui.diffEasy}</option>
                <option value="בינוני">{ui.diffMedium}</option>
                <option value="קשה">{ui.diffHard}</option>
                <option value="מומחה">{ui.diffExpert}</option>
              </select>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <Stat value={String(categories.length)} label={ui.catsLbl} />
            <Stat value={String(rows.length)} label={ui.shownLbl} />
            <Stat value="RTL" label={ui.rtlLbl} />
          </div>

          <div className="admin-scroll grid gap-3">
            {rows.map(question => (
              <article key={String(question.id)} className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 transition hover:border-gold/35 hover:bg-white/10">
                <div className="flex flex-col justify-between gap-4 xl:flex-row">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-gold/15 px-3 py-1 text-gold">{question.category}</span>
                      <span className="rounded-full bg-azure/15 px-3 py-1 text-azure">{question.difficulty}</span>
                    </div>
                    <h3 className="text-xl font-extrabold">{question.question}</h3>
                    <p className="mt-2 text-white/58">{ui.correct}: {question.answers[question.correctIndex]}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => { setForm(question); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><EditIcon size={16} />{ui.edit}</button>
                    <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => setLocalQuestions(previous => [{ ...question, id: `copy-${Date.now()}`, question: `${question.question} (עותק)` }, ...previous])}><CopyIcon size={16} />{ui.duplicate}</button>
                    <button className="ghost-button focus-ring inline-flex items-center gap-2" onClick={() => setLocalQuestions(previous => previous.filter(item => item.id !== question.id))}><DeleteIcon size={16} />{ui.delete}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function QuestionForm({ ui, locale, form, setForm, save, reset }: { ui: Record<string, string>; locale: Locale; form: AdminQuestion; setForm: (question: AdminQuestion) => void; save: () => void; reset: () => void }) {
  const letters = OPTION_LETTERS[locale] || LETTERS;
  return (
    <div className="space-y-4">
      <Field label={ui.qLabel}><input className="form-input" value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} /></Field>
      {form.answers.map((answer, index) => (
        <Field key={index} label={`${ui.answerLbl} ${letters[index]}`}>
          <input className="form-input" value={answer} onChange={event => {
            const answers = form.answers.map((item, answerIndex) => answerIndex === index ? event.target.value : item);
            setForm({ ...form, answers, options: answers });
          }} />
        </Field>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <select className="form-input" value={form.correctIndex} onChange={event => setForm({ ...form, correctIndex: Number(event.target.value) })}>
          {letters.map((letter, index) => <option key={letter} value={index}>{ui.correctOpt}: {letter}</option>)}
        </select>
        <select className="form-input" value={form.difficulty} onChange={event => setForm({ ...form, difficulty: event.target.value })}>
          <option value="קל">{ui.diffEasy}</option>
          <option value="בינוני">{ui.diffMedium}</option>
          <option value="קשה">{ui.diffHard}</option>
          <option value="מומחה">{ui.diffExpert}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="form-input" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} />
        <input className="form-input" value={form.imageUrl || ''} onChange={event => setForm({ ...form, imageUrl: event.target.value })} placeholder={ui.imageLink} />
      </div>
      <button className="premium-button focus-ring inline-flex w-full items-center justify-center gap-2" onClick={save}><ConfirmIcon size={16} />{ui.saveQuestion}</button>
      <button className="ghost-button focus-ring inline-flex w-full items-center justify-center gap-2" onClick={reset}><CloseIcon size={16} />{ui.clearForm}</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-white/65">{label}</span>{children}</label>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-3xl bg-white/[0.08] p-5"><div className="text-3xl font-black text-gold">{value}</div><div className="text-white/55">{label}</div></div>;
}
