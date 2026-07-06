export const INITIAL_QUESTION_SAMPLE_SIZE = 120;
export const API_QUESTION_SAMPLE_SIZE = 640;
export const API_QUESTION_LIMIT_MAX = 2000;
export const API_QUESTION_EXCLUDE_MAX = 1200;
export const CLIENT_SEEN_QUESTION_LIMIT = 5000;

type QuestionIdentity = string | number;

type SamplingOptions<T> = {
  excludeIds?: Iterable<QuestionIdentity>;
  getId?: (question: T) => QuestionIdentity | undefined;
  random?: () => number;
};

function shuffleCopy<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function parseQuestionExcludeParam(value: string | null) {
  if (!value) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const rawId of value.split(',')) {
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= API_QUESTION_EXCLUDE_MAX) break;
  }
  return ids;
}

export function balancedQuestionSample<T extends { category: string; id?: QuestionIdentity }>(
  questions: T[],
  maxQuestions: number,
  options: SamplingOptions<T> = {}
) {
  const random = options.random || Math.random;
  const getId = options.getId || ((question: T) => question.id);
  const excludeIds = new Set(Array.from(options.excludeIds || [], String));
  if (questions.length <= maxQuestions && excludeIds.size === 0) return questions;
  const preferredQuestions = excludeIds.size
    ? questions.filter(question => {
        const id = getId(question);
        return id === undefined || !excludeIds.has(String(id));
      })
    : questions;
  const fallbackQuestions = excludeIds.size && preferredQuestions.length < maxQuestions
    ? questions.filter(question => {
        const id = getId(question);
        return id !== undefined && excludeIds.has(String(id));
      })
    : [];
  const sampleSource = preferredQuestions.length >= maxQuestions
    ? preferredQuestions
    : [...preferredQuestions, ...fallbackQuestions];
  const groups = new Map<string, T[]>();
  for (const question of sampleSource) {
    const group = groups.get(question.category);
    if (group) group.push(question);
    else groups.set(question.category, [question]);
  }
  const categories = shuffleCopy(Array.from(groups.keys()), random);
  const shuffledGroups = new Map(categories.map(category => [category, shuffleCopy(groups.get(category) || [], random)]));
  const sample: T[] = [];
  let hasAvailableQuestions = true;

  while (sample.length < maxQuestions && hasAvailableQuestions) {
    hasAvailableQuestions = false;
    for (const category of categories) {
      const group = shuffledGroups.get(category);
      const question = group?.pop();
      if (!question) continue;
      sample.push(question);
      hasAvailableQuestions = true;
      if (sample.length >= maxQuestions) break;
    }
  }

  return sample;
}

export function clampQuestionLimit(value: string | null, fallback = API_QUESTION_SAMPLE_SIZE) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(API_QUESTION_LIMIT_MAX, Math.max(1, parsed));
}
