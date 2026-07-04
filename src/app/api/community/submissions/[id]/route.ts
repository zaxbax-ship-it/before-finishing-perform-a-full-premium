import { NextResponse } from 'next/server';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { internalServerError, publicJsonError, readLimitedJson, redactSubmissionForClient } from '@/lib/api/communitySecurity';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readLimitedJson<{ action?: 'approve' | 'reject'; note?: string }>(request);
    const repositories = getRepositoryProvider();

    if (body.action === 'approve') {
      const submission = await repositories.submissions.approve({ submissionId: id, note: body.note || 'Approved by admin.' });
      if (!submission) return publicJsonError('Submission not found.', 404);
      await repositories.auditLogs.create({
        actorLabel: 'local-admin',
        action: 'admin_approved_submission',
        targetType: 'community_submission',
        targetId: id,
        details: { note: body.note || 'Approved by admin.' }
      });
      return NextResponse.json({ ok: true, submission: redactSubmissionForClient(submission) });
    }

    if (body.action === 'reject') {
      const submission = await repositories.submissions.reject({ submissionId: id, note: body.note || 'Rejected by admin.' });
      if (!submission) return publicJsonError('Submission not found.', 404);
      await repositories.auditLogs.create({
        actorLabel: 'local-admin',
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
