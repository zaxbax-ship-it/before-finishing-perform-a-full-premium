import fs from 'node:fs';
import path from 'node:path';

const SOURCE = path.resolve(process.argv[2] || 'C:/Users/יוסי דוידוב/Documents/Codex/2026-07-04/10-000-4-10/outputs/quality_trivia_20000_he.csv');
const TARGET = path.resolve(process.argv[3] || 'src/data/questions.json');
const REPORT = path.resolve(process.argv[4] || 'reports/question-import-quality-20000-he.json');
const SOURCE_TAG = 'source:quality_trivia_20000_he';
const TRANSLATION_PENDING_TAG = 'translation:pending';

const HEBREW_DIFFICULTIES = ['קל', 'בינוני', 'קשה', 'מומחה'];
const CORRECT_LETTERS = new Map([
  ['א', 0],
  ['ב', 1],
  ['ג', 2],
  ['ד', 3],
  ['a', 0],
  ['b', 1],
  ['c', 2],
  ['d', 3]
]);

const CATEGORY_MAP = new Map([
  ['היסטוריה', 'היסטוריה'],
  ['רכילות כלל עולמית', 'רכילות ותרבות אמריקאית ועולמית'],
  ['אקטואליה כלל עולמית', 'פוליטיקה'],
  ['רפואה', 'רפואה'],
  ['קולנוע', 'קולנוע'],
  ['מוזיקה', 'מוזיקה'],
  ['ספורט', 'ספורט'],
  ['עולם הרכב', 'עולם הרכב'],
  ['נטפליקס', 'נטפליקס'],
  ['עולם בעלי החיים', 'עולם בעלי החיים']
]);

const report = {
  sourceFile: SOURCE,
  targetFile: TARGET,
  generatedAt: new Date().toISOString(),
  sourceRows: 0,
  existingBefore: 0,
  imported: 0,
  skipped: 0,
  duplicates: 0,
  invalid: 0,
  finalTotal: 0,
  categoryMappings: {},
  invalidReasons: {},
  duplicateExamples: [],
  invalidExamples: [],
  translationStatus: {
    he: { imported: 0, status: 'source-ready' },
    en: { imported: 0, status: 'pending-paid-or-reviewed-translation' },
    ar: { imported: 0, status: 'pending-paid-or-reviewed-translation' },
    ru: { imported: 0, status: 'pending-paid-or-reviewed-translation' },
    am: { imported: 0, status: 'pending-paid-or-reviewed-translation' }
  }
};

const targetData = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
const existingQuestions = Array.isArray(targetData.questions) ? targetData.questions : [];
const preservedQuestions = existingQuestions.filter(question => !question.tags?.includes(SOURCE_TAG));
report.existingBefore = preservedQuestions.length;

const seen = new Map();
for (const question of preservedQuestions) {
  const key = duplicateKey(question.question, question.correctAnswer || question.options?.[question.correctIndex] || '');
  if (key) seen.set(key, { id: question.id, question: question.question, correctAnswer: question.correctAnswer });
}

const csv = stripBom(fs.readFileSync(SOURCE, 'utf8'));
const rows = parseCsv(csv);
const header = rows.shift();
report.sourceRows = rows.length;

const requiredHeader = ['id', 'category', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'correct_answer'];
if (!header || requiredHeader.some((column, index) => header[index] !== column)) {
  throw new Error(`Unexpected CSV header. Expected ${requiredHeader.join(',')}`);
}

const imported = [];
const fileSeen = new Map();

for (const row of rows) {
  const record = rowToRecord(header, row);
  const validation = validateRecord(record);
  if (!validation.ok) {
    skipInvalid(record, validation.reason);
    continue;
  }

  const sourceCategory = clean(record.category);
  const mappedCategory = CATEGORY_MAP.get(sourceCategory);
  if (!mappedCategory) {
    skipInvalid(record, 'invalid_category');
    continue;
  }
  report.categoryMappings[sourceCategory] = mappedCategory;

  const questionText = clean(record.question);
  const options = [record.option_a, record.option_b, record.option_c, record.option_d].map(clean);
  const correctIndex = CORRECT_LETTERS.get(clean(record.correct_option).toLocaleLowerCase('he'));
  const correctAnswer = clean(record.correct_answer);
  const key = duplicateKey(questionText, correctAnswer);
  if (!key) {
    skipInvalid(record, 'broken_formatting');
    continue;
  }

  const duplicate = seen.get(key) || fileSeen.get(key);
  if (duplicate) {
    report.duplicates += 1;
    report.skipped += 1;
    if (report.duplicateExamples.length < 12) {
      report.duplicateExamples.push({
        incomingId: record.id,
        incomingQuestion: questionText,
        existingId: duplicate.id,
        existingQuestion: duplicate.question,
        correctAnswer
      });
    }
    continue;
  }

  const sourceId = clean(record.id);
  const difficulty = difficultyForSourceId(sourceId);
  const question = {
    id: `quality-he-${sourceId}`,
    category: mappedCategory,
    difficulty,
    question: questionText,
    options,
    correctIndex,
    correctAnswer,
    explanation: buildExplanation(correctAnswer, mappedCategory),
    tags: [SOURCE_TAG, TRANSLATION_PENDING_TAG, `source-category:${sourceCategory}`],
    translations: {}
  };

  imported.push(question);
  seen.set(key, question);
  fileSeen.set(key, question);
}

const merged = [...preservedQuestions, ...imported];
targetData.schemaVersion = targetData.schemaVersion || '3.0';
targetData.language = targetData.language || 'he';
targetData.questions = merged;

report.imported = imported.length;
report.skipped += report.invalid;
report.finalTotal = merged.length;
report.translationStatus.he.imported = imported.length;

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(TARGET, `${JSON.stringify(targetData, null, 2)}\n`, 'utf8');
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  sourceRows: report.sourceRows,
  imported: report.imported,
  skipped: report.skipped,
  duplicates: report.duplicates,
  invalid: report.invalid,
  finalTotal: report.finalTotal,
  report: REPORT
}, null, 2));

function rowToRecord(columns, values) {
  return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
}

function validateRecord(record) {
  const question = clean(record.question);
  const options = [record.option_a, record.option_b, record.option_c, record.option_d].map(clean);
  const correctIndex = CORRECT_LETTERS.get(clean(record.correct_option).toLocaleLowerCase('he'));
  const correctAnswer = clean(record.correct_answer);

  if (!question) return { ok: false, reason: 'missing_question' };
  if (looksCorrupted(question) || options.some(looksCorrupted) || looksCorrupted(correctAnswer)) return { ok: false, reason: 'corrupted_characters' };
  if (options.some(option => !option)) return { ok: false, reason: 'missing_answers' };
  if (options.length !== 4) return { ok: false, reason: 'fewer_than_four_answers' };
  if (new Set(options.map(normalizeComparable)).size !== 4) return { ok: false, reason: 'duplicate_answers' };
  if (correctIndex === undefined || correctIndex < 0 || correctIndex > 3) return { ok: false, reason: 'invalid_correct_answer' };
  if (normalizeComparable(options[correctIndex]) !== normalizeComparable(correctAnswer)) return { ok: false, reason: 'invalid_correct_answer' };
  if (!clean(record.category)) return { ok: false, reason: 'invalid_category' };
  if (question.length < 8 || options.some(option => option.length > 160)) return { ok: false, reason: 'broken_formatting' };
  return { ok: true };
}

function skipInvalid(record, reason) {
  report.invalid += 1;
  report.invalidReasons[reason] = (report.invalidReasons[reason] || 0) + 1;
  if (report.invalidExamples.length < 12) {
    report.invalidExamples.push({
      id: record.id,
      reason,
      question: clean(record.question),
      category: clean(record.category)
    });
  }
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some(value => value.length > 0)) rows.push(row);
  }

  return rows;
}

function difficultyForSourceId(sourceId) {
  const numeric = Number.parseInt(sourceId, 10);
  const bucket = Number.isFinite(numeric) ? numeric % 10 : 4;
  if (bucket === 0) return HEBREW_DIFFICULTIES[3];
  if (bucket <= 2) return HEBREW_DIFFICULTIES[2];
  if (bucket <= 5) return HEBREW_DIFFICULTIES[1];
  return HEBREW_DIFFICULTIES[0];
}

function buildExplanation(correctAnswer, category) {
  return `התשובה הנכונה היא ${correctAnswer}. זהו פרט טריוויה מתחום ${category}, וכדאי לזכור אותו דרך ההקשר של השאלה והתשובות הסמוכות.`;
}

function duplicateKey(question, correctAnswer) {
  const normalizedQuestion = normalizeComparable(question);
  const normalizedAnswer = normalizeComparable(correctAnswer);
  return normalizedQuestion && normalizedAnswer ? `${normalizedQuestion}::${normalizedAnswer}` : '';
}

function normalizeComparable(value) {
  return clean(value)
    .normalize('NFKC')
    .replace(/[״"׳']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('he');
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function looksCorrupted(value) {
  return /[\uFFFD]/u.test(value) || /(?:×[\u0080-\u00BF]){2,}/u.test(value) || /(?:ג€�|ג€™|ג€|ג€”)/u.test(value);
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
