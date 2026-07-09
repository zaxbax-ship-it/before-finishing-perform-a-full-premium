import 'server-only';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { ApprovedQuestion } from '@/lib/domain/models';
import type { AdminContext } from '@/lib/auth/types';
import type { Locale, Question } from '@/lib/types';

/**
 * Question CMS — server-persisted editorial management over the
 * approvedQuestions repository. Replaces the legacy localStorage-only admin
 * editor: every mutation goes through the repository layer (portable to
 * Supabase and native admin clients) and writes an audit-log entry.
 *
 * Lifecycle: draft → published → archived. `isActive` remains the single
 * gameplay-visibility switch (only `published` questions are active), so
 * existing gameplay code keeps working unchanged. Legacy rows without a
 * status derive one from isActive.
 */

export type QuestionStatus = 'draft' | 'published' | 'archived';

export type CmsQuestionRow = {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  status: QuestionStatus;
  locale: string;
  /** Locales with a translated question text (source locale included). */
  translations: string[];
  updatedAt: string;
};

export type CmsListQuery = {
  search?: string;
  category?: string;
  difficulty?: string;
  status?: QuestionStatus | 'all';
  page?: number;
  pageSize?: number;
};

export type CmsListResult = {
  rows: CmsQuestionRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  difficulties: string[];
};

export type CmsQuestionDraft = {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: string;
  explanation?: string;
  locale?: Locale;
  status?: QuestionStatus;
};

const LOCALES: Locale[] = ['he', 'en', 'ar', 'ru', 'am'];

export function statusOf(question: ApprovedQuestion): QuestionStatus {
  return question.status || (question.isActive ? 'published' : 'archived');
}

function toRow(question: ApprovedQuestion): CmsQuestionRow {
  const translated = LOCALES.filter(locale =>
    locale === question.locale || Boolean(question.translations?.[locale]?.question)
  );
  return {
    id: String(question.id),
    question: question.question,
    category: question.category,
    difficulty: question.difficulty,
    status: statusOf(question),
    locale: question.locale,
    translations: translated,
    updatedAt: question.updatedAt
  };
}

export async function listCmsQuestions(repositories: RepositoryProvider, query: CmsListQuery = {}): Promise<CmsListResult> {
  const all = await repositories.approvedQuestions.list({ activeOnly: false });

  const search = query.search?.trim().toLowerCase();
  let filtered = all;
  if (search) filtered = filtered.filter(question => question.question.toLowerCase().includes(search) || String(question.id).toLowerCase().includes(search));
  if (query.category) filtered = filtered.filter(question => question.category === query.category);
  if (query.difficulty) filtered = filtered.filter(question => question.difficulty === query.difficulty);
  if (query.status && query.status !== 'all') filtered = filtered.filter(question => statusOf(question) === query.status);

  const pageSize = Math.min(100, Math.max(5, query.pageSize || 25));
  const page = Math.max(1, query.page || 1);

  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize).map(toRow),
    total: filtered.length,
    page,
    pageSize,
    categories: [...new Set(all.map(question => question.category))].sort(),
    difficulties: [...new Set(all.map(question => question.difficulty))]
  };
}

export async function getCmsQuestion(repositories: RepositoryProvider, id: string): Promise<ApprovedQuestion | undefined> {
  return repositories.approvedQuestions.findById(id);
}

function validateDraft(draft: CmsQuestionDraft): string | undefined {
  if (!draft.question?.trim() || draft.question.trim().length < 8) return 'Question text must be at least 8 characters.';
  if (!Array.isArray(draft.options) || draft.options.length !== 4 || draft.options.some(option => !option?.trim())) return 'Exactly 4 non-empty options are required.';
  if (!Number.isInteger(draft.correctIndex) || draft.correctIndex < 0 || draft.correctIndex > 3) return 'correctIndex must be 0-3.';
  if (!draft.category?.trim()) return 'Category is required.';
  if (!draft.difficulty?.trim()) return 'Difficulty is required.';
  return undefined;
}

export type CmsResult<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

export async function createCmsQuestion(
  repositories: RepositoryProvider,
  actor: AdminContext,
  draft: CmsQuestionDraft
): Promise<CmsResult<ApprovedQuestion>> {
  const invalid = validateDraft(draft);
  if (invalid) return { ok: false, error: invalid };

  const now = new Date().toISOString();
  const status: QuestionStatus = draft.status || 'draft';
  const question: ApprovedQuestion = {
    id: `q-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: draft.question.trim(),
    options: draft.options.map(option => option.trim()),
    correctIndex: draft.correctIndex,
    correctAnswer: draft.options[draft.correctIndex]?.trim(),
    category: draft.category.trim(),
    difficulty: draft.difficulty.trim(),
    explanation: draft.explanation?.trim() || undefined,
    locale: draft.locale || 'he',
    status,
    isActive: status === 'published',
    publishedAt: now,
    createdAt: now,
    updatedAt: now
  };
  const created = await repositories.approvedQuestions.create(question);
  await audit(repositories, actor, 'admin_question_created', String(created.id), { status, category: question.category });
  return { ok: true, value: created };
}

export async function updateCmsQuestion(
  repositories: RepositoryProvider,
  actor: AdminContext,
  id: string,
  draft: Partial<CmsQuestionDraft>
): Promise<CmsResult<ApprovedQuestion>> {
  const existing = await repositories.approvedQuestions.findById(id);
  if (!existing) return { ok: false, error: 'Question was not found.' };

  const merged: CmsQuestionDraft = {
    question: draft.question ?? existing.question,
    options: draft.options ?? existing.options,
    correctIndex: draft.correctIndex ?? existing.correctIndex,
    category: draft.category ?? existing.category,
    difficulty: draft.difficulty ?? existing.difficulty,
    explanation: draft.explanation ?? existing.explanation
  };
  const invalid = validateDraft(merged);
  if (invalid) return { ok: false, error: invalid };

  const updated = await repositories.approvedQuestions.update(id, {
    ...merged,
    correctAnswer: merged.options[merged.correctIndex],
    explanation: merged.explanation || undefined
  });
  if (!updated) return { ok: false, error: 'Question was not found.' };
  await audit(repositories, actor, 'admin_question_updated', id, { category: merged.category });
  return { ok: true, value: updated };
}

export async function setCmsQuestionStatus(
  repositories: RepositoryProvider,
  actor: AdminContext,
  id: string,
  status: QuestionStatus
): Promise<CmsResult> {
  const existing = await repositories.approvedQuestions.findById(id);
  if (!existing) return { ok: false, error: 'Question was not found.' };
  await repositories.approvedQuestions.update(id, { status, isActive: status === 'published' });
  await audit(repositories, actor, 'admin_question_status', id, { from: statusOf(existing), to: status });
  return { ok: true };
}

export async function duplicateCmsQuestion(
  repositories: RepositoryProvider,
  actor: AdminContext,
  id: string
): Promise<CmsResult<ApprovedQuestion>> {
  const existing = await repositories.approvedQuestions.findById(id);
  if (!existing) return { ok: false, error: 'Question was not found.' };
  const now = new Date().toISOString();
  const copy: ApprovedQuestion = {
    ...existing,
    id: `q-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: `${existing.question} (עותק)`,
    status: 'draft',
    isActive: false,
    publishedAt: now,
    createdAt: now,
    updatedAt: now
  };
  const created = await repositories.approvedQuestions.create(copy);
  await audit(repositories, actor, 'admin_question_duplicated', String(created.id), { sourceId: id });
  return { ok: true, value: created };
}

export async function bulkCmsAction(
  repositories: RepositoryProvider,
  actor: AdminContext,
  ids: string[],
  action: 'publish' | 'draft' | 'archive'
): Promise<CmsResult<{ affected: number }>> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return { ok: false, error: 'Between 1 and 200 question ids are required.' };
  }
  const status: QuestionStatus = action === 'publish' ? 'published' : action === 'draft' ? 'draft' : 'archived';
  let affected = 0;
  for (const id of ids) {
    const updated = await repositories.approvedQuestions.update(id, { status, isActive: status === 'published' });
    if (updated) affected += 1;
  }
  await audit(repositories, actor, 'admin_question_bulk', ids.join(','), { action, affected });
  return { ok: true, value: { affected } };
}

/**
 * Usage analytics from real multiplayer data: how often a question was
 * featured in recent games and how players answered. Solo gameplay does not
 * report per-question events, which is stated in the response.
 */
export async function questionUsageStats(repositories: RepositoryProvider, id: string) {
  const games = await repositories.multiplayer.listGames({ limit: 100 });
  let featured = 0;
  let answers = 0;
  let correct = 0;

  for (const game of games) {
    const rounds = await repositories.multiplayer.listRounds(game.id);
    const matching = rounds.filter(round => String(round.questionId) === String(id));
    if (matching.length === 0) continue;
    featured += matching.length;
    const gameAnswers = await repositories.multiplayer.listAnswers(game.id);
    for (const round of matching) {
      const roundAnswers = gameAnswers.filter(answer => answer.roundId === round.id);
      answers += roundAnswers.length;
      correct += roundAnswers.filter(answer => answer.isCorrect).length;
    }
  }

  return {
    featuredInRecentGames: featured,
    answers,
    correct,
    successRate: answers > 0 ? Math.round((correct / answers) * 100) : null,
    note: 'מבוסס על 100 משחקי המרובה האחרונים; משחקי יחיד אינם מדווחים אירועים לשרת.'
  };
}

async function audit(repositories: RepositoryProvider, actor: AdminContext, action: string, targetId: string, details: Record<string, unknown>) {
  await repositories.auditLogs.create({
    actorLabel: actor.email,
    action,
    targetType: 'question',
    targetId,
    details
  });
}

export type { Question };
