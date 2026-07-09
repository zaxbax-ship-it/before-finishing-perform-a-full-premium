import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import {
  bulkCmsAction,
  createCmsQuestion,
  duplicateCmsQuestion,
  getCmsQuestion,
  listCmsQuestions,
  questionUsageStats,
  setCmsQuestionStatus,
  updateCmsQuestion,
  type CmsListQuery,
  type CmsQuestionDraft,
  type QuestionStatus
} from '@/lib/admin/questionCmsService';
import { internalServerError, readLimitedJson } from '@/lib/api/communitySecurity';

// Question CMS. GET lists (or returns one question + usage stats via ?id=);
// POST mutates via a typed action envelope. Reads require questions.read,
// writes require questions.write; every mutation is audit-logged.
export async function GET(request: Request) {
  const guard = await guardApiPermission('questions.read');
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const repositories = getRepositoryProvider();

    const id = url.searchParams.get('id');
    if (id) {
      const question = await getCmsQuestion(repositories, id);
      if (!question) return NextResponse.json({ ok: false, error: 'Question was not found.' }, { status: 404 });
      const usage = await questionUsageStats(repositories, id);
      return NextResponse.json({ ok: true, question, usage }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const query: CmsListQuery = {
      search: url.searchParams.get('search') || undefined,
      category: url.searchParams.get('category') || undefined,
      difficulty: url.searchParams.get('difficulty') || undefined,
      status: (url.searchParams.get('status') as CmsListQuery['status']) || 'all',
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 25
    };
    const result = await listCmsQuestions(repositories, query);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-questions:get', error);
  }
}

type ActionBody = {
  action?: unknown;
  id?: unknown;
  ids?: unknown;
  status?: unknown;
  draft?: unknown;
};

export async function POST(request: Request) {
  const guard = await guardApiPermission('questions.write');
  if (!guard.ok) return guard.response;

  try {
    const body = await readLimitedJson<ActionBody>(request);
    const repositories = getRepositoryProvider();
    const action = typeof body.action === 'string' ? body.action : '';
    const id = typeof body.id === 'string' ? body.id : '';

    if (action === 'create') {
      const result = await createCmsQuestion(repositories, guard.context, body.draft as CmsQuestionDraft);
      return respond(result, created => ({ question: created }));
    }
    if (action === 'update' && id) {
      const result = await updateCmsQuestion(repositories, guard.context, id, body.draft as Partial<CmsQuestionDraft>);
      return respond(result, updated => ({ question: updated }));
    }
    if (action === 'set_status' && id && typeof body.status === 'string') {
      const result = await setCmsQuestionStatus(repositories, guard.context, id, body.status as QuestionStatus);
      return respond(result, () => ({}));
    }
    if (action === 'duplicate' && id) {
      const result = await duplicateCmsQuestion(repositories, guard.context, id);
      return respond(result, copy => ({ question: copy }));
    }
    if (action === 'bulk' && Array.isArray(body.ids) && typeof body.status === 'string') {
      const bulk = body.status === 'published' ? 'publish' : body.status === 'draft' ? 'draft' : 'archive';
      const result = await bulkCmsAction(repositories, guard.context, body.ids as string[], bulk);
      return respond(result, value => ({ ...value }));
    }

    return NextResponse.json({ ok: false, error: 'Unknown or malformed CMS action.' }, { status: 400 });
  } catch (error) {
    return internalServerError('admin-questions:post', error);
  }
}

function respond<T>(result: { ok: true; value?: T } | { ok: false; error: string }, shape: (value: T) => Record<string, unknown>) {
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...(result.value !== undefined ? shape(result.value) : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}
