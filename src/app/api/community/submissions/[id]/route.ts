import { NextResponse } from 'next/server';
import type { Question } from '@/lib/types';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { guardApiPermission } from '@/lib/auth/guards';
import { internalServerError, publicJsonError, readLimitedJson, redactSubmissionForClient } from '@/lib/api/communitySecurity';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EditedQuestionPayload = {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  category?: unknown;
  difficulty?: unknown;
  explanation?: unknown;
};

/**
 * Build the game-ready Question from the admin's edits (Stage 11 edit-before-
 * publish). Returns null if edits are absent; throws a message if malformed.
 */
function buildEditedQuestion(id: string, edited: EditedQuestionPayload | undefined): Question | null | string {
  if (!edited || typeof edited !== 'object') return null;
  const question = typeof edited.question === 'string' ? edited.question.trim() : '';
  const options = Array.isArray(edited.options) ? edited.options.map(option => (typeof option === 'string' ? option.trim() : '')) : [];
  const correctIndex = Number(edited.correctIndex);
  if (!question) return 'An edited question requires question text.';
  if (options.length !== 4 || options.some(option => !option)) return 'An edited question requires four non-empty answers.';
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return 'The correct answer index must be 0-3.';
  if (new Set(options.map(o => o.toLowerCase())).size !== 4) return 'The four answers must be distinct.';
  return {
    id: `community-${id}`,
    category: typeof edited.category === 'string' && edited.category.trim() ? edited.category.trim() : 'ידע כללי',
    difficulty: typeof edited.difficulty === 'string' && edited.difficulty.trim() ? edited.difficulty.trim() : 'בינוני',
    question,
    options,
    correctIndex,
    correctAnswer: options[correctIndex],
    explanation: typeof edited.explanation === 'string' ? edited.explanation.trim() : '',
    tags: ['community']
  };
}

// Approving/rejecting a submission is a privileged moderation action. Approving
// may carry admin edits, which become the published question.
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardApiPermission('submissions.review');
  if (!guard.ok) return guard.response;
  const actor = guard.context;

  try {
    const { id } = await context.params;
    const body = await readLimitedJson<{ action?: 'approve' | 'reject'; note?: string; edited?: EditedQuestionPayload }>(request);
    const repositories = getRepositoryProvider();

    if (body.action === 'approve') {
      const editedResult = buildEditedQuestion(id, body.edited);
      if (typeof editedResult === 'string') return publicJsonError(editedResult);
      const editedQuestion = editedResult || undefined;

      const submission = await repositories.submissions.approve({ submissionId: id, adminUserId: actor.authUserId, note: body.note || 'Approved by admin.', editedQuestion });
      if (!submission) return publicJsonError('Submission not found.', 404);

      // Future-ready contributor reputation (architecture only — no points yet).
      const contributorId = submission.draft.contributorId;
      if (contributorId) {
        try { await repositories.reputation.addEvent({ contributorId, submissionId: id, delta: 0, reason: 'approved' }); } catch { /* non-blocking */ }
      }

      await repositories.auditLogs.create({
        actorAdminUserId: actor.authUserId,
        actorLabel: actor.email,
        action: 'admin_approved_submission',
        targetType: 'community_submission',
        targetId: id,
        details: { note: body.note || 'Approved by admin.', edited: Boolean(editedQuestion) }
      });
      return NextResponse.json({ ok: true, submission: redactSubmissionForClient(submission) });
    }

    if (body.action === 'reject') {
      const submission = await repositories.submissions.reject({ submissionId: id, adminUserId: actor.authUserId, note: body.note || 'Rejected by admin.' });
      if (!submission) return publicJsonError('Submission not found.', 404);
      const contributorId = submission.draft.contributorId;
      if (contributorId) {
        try { await repositories.reputation.addEvent({ contributorId, submissionId: id, delta: 0, reason: 'rejected' }); } catch { /* non-blocking */ }
      }
      await repositories.auditLogs.create({
        actorAdminUserId: actor.authUserId,
        actorLabel: actor.email,
        action: 'admin_rejected_submission',
        targetType: 'community_submission',
        targetId: id,
        details: { note: body.note || 'Rejected by admin.' }
      });
      return NextResponse.json({ ok: true, submission: redactSubmissionForClient(submission) });
    }

    return publicJsonError('Action must be approve or reject.');
  } catch (error) {
    return internalServerError('community-submissions:patch', error);
  }
}
