import type { Question } from '@/lib/types';

/**
 * Editorial helpers (Stage 11) — the AI editor's toolkit for turning a
 * contributor's bare {question, correctAnswer} into a complete, game-ready
 * question. Pure and deterministic (seeded), so the same submission always
 * yields the same distractors, category, difficulty and shuffle — which keeps
 * the pipeline testable and the admin review stable across refreshes.
 *
 * The mock provider uses these directly; the OpenAI provider produces richer
 * results but falls back to these; and the safety net uses them so a timed-out
 * or budget-limited request still yields a valid four-option question for a human
 * to review. No auto-publishing happens anywhere — this only *prepares* content.
 */

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeComparable(value: string): string {
  return cleanText(value).toLowerCase().replace(/[?!.,;:"'׳״]/g, '');
}

/** FNV-1a → a small deterministic RNG seeded by the submission text. */
export function seededRng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export function improveQuestionWording(value: string): string {
  const cleaned = cleanText(value);
  if (!cleaned) return cleaned;
  const capitalized = /^[a-z]/.test(cleaned) ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned;
  return /[?؟]$/.test(capitalized) ? capitalized : `${capitalized}?`;
}

export function improveAnswerWording(value: string): string {
  return cleanText(value).replace(/[.]+$/, '');
}

/**
 * Generate exactly three high-quality, distinct incorrect answers. Real answers
 * from the existing question bank make the best distractors (they read naturally
 * and match the domain), so we draw from there first, preferring same-category
 * peers, then pad with deterministic variants only if the bank is too small.
 */
export function generateWrongAnswers(correctAnswer: string, existingQuestions: Question[], category: string, seed: string): string[] {
  const rng = seededRng(seed + '|distractors');
  const correctKey = normalizeComparable(correctAnswer);
  const seen = new Set<string>([correctKey]);
  const pool: string[] = [];

  const answerOf = (q: Question) => cleanText(q.correctAnswer || q.options?.[q.correctIndex] || '');
  const sameCategory = existingQuestions.filter(q => q.category === category);
  const ordered = [...sameCategory, ...existingQuestions];
  for (const q of ordered) {
    const answer = answerOf(q);
    const key = normalizeComparable(answer);
    if (!answer || key.length < 1 || seen.has(key)) continue;
    seen.add(key);
    pool.push(answer);
  }

  // Deterministic shuffle of the candidate pool.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const wrong = pool.slice(0, 3);
  let padIndex = 1;
  while (wrong.length < 3) {
    const candidate = fallbackVariant(correctAnswer, padIndex);
    padIndex += 1;
    if (!seen.has(normalizeComparable(candidate))) {
      seen.add(normalizeComparable(candidate));
      wrong.push(candidate);
    }
    if (padIndex > 20) break;
  }
  return wrong.slice(0, 3);
}

function fallbackVariant(correctAnswer: string, index: number): string {
  const numeric = Number(correctAnswer.replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(numeric) && correctAnswer.trim() !== '') {
    const deltas = [1, -1, 2, -2, 10, -10];
    const delta = deltas[(index - 1) % deltas.length];
    return correctAnswer.replace(String(numeric), String(numeric + delta));
  }
  const suffixes = ['—', '·', '∙'];
  return `${cleanText(correctAnswer)} ${suffixes[(index - 1) % suffixes.length]}`.trim();
}

/** Infer the category from the closest existing question, else the bank's mode. */
export function inferCategory(question: string, correctAnswer: string, existingQuestions: Question[], fallback: string): string {
  const words = new Set(normalizeComparable(`${question} ${correctAnswer}`).split(' ').filter(w => w.length > 3));
  let best: { category: string; overlap: number } | null = null;
  for (const q of existingQuestions) {
    const qWords = normalizeComparable(q.question).split(' ').filter(w => w.length > 3);
    const overlap = qWords.reduce((sum, w) => sum + (words.has(w) ? 1 : 0), 0);
    if (overlap > 0 && (!best || overlap > best.overlap)) best = { category: q.category, overlap };
  }
  if (best) return best.category;
  const counts = new Map<string, number>();
  for (const q of existingQuestions) counts.set(q.category, (counts.get(q.category) || 0) + 1);
  let mode = fallback;
  let max = 0;
  for (const [category, count] of counts) if (count > max) { max = count; mode = category; }
  return mode;
}

/** Estimate difficulty from wording complexity; return a bank-consistent label. */
export function inferDifficulty(question: string, correctAnswer: string, labels: { easy: string; medium: string; hard: string; expert: string }): string {
  const qWords = cleanText(question).split(' ').filter(Boolean).length;
  const answerLen = cleanText(correctAnswer).length;
  const score = qWords + (answerLen > 24 ? 6 : answerLen > 12 ? 3 : 0) + (/\d{3,}/.test(correctAnswer) ? 4 : 0);
  if (score <= 6) return labels.easy;
  if (score <= 12) return labels.medium;
  if (score <= 20) return labels.hard;
  return labels.expert;
}

/** Deterministically shuffle the correct answer among three distractors. */
export function shuffleOptions(correctAnswer: string, wrongAnswers: string[], seed: string): { options: string[]; correctIndex: number } {
  const rng = seededRng(seed + '|shuffle');
  const options = [correctAnswer, ...wrongAnswers];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, correctIndex: options.indexOf(correctAnswer) };
}

/** Duplicate / near-duplicate risk (0-100) against the existing bank + queue. */
export function duplicateRiskFor(question: string, existingQuestions: Question[], existingSubmissions: Array<{ question: string }>): { risk: number; duplicateId?: string | number } {
  const key = normalizeComparable(question);
  if (!key) return { risk: 0 };
  const exact = existingQuestions.find(q => normalizeComparable(q.question) === key);
  if (exact) return { risk: 96, duplicateId: exact.id };
  if (existingSubmissions.some(s => normalizeComparable(s.question) === key)) return { risk: 90 };
  const near = existingQuestions.find(q => {
    const other = normalizeComparable(q.question);
    return other.length > 8 && (other.includes(key) || key.includes(other));
  });
  return near ? { risk: 68, duplicateId: near.id } : { risk: 8 };
}
