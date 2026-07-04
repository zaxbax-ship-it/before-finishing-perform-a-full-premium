import { NextResponse } from 'next/server';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { action?: 'approve' | 'reject'; note?: string };
    const repositories = getRepositoryProvider();

    if (body.action === 'approve') {
      const submission = await repositories.submissions.approve({ submissionId: id, note: body.note || 'Approved by admin.' });
      if (!submission) return jsonError('Submission not found.', 404);
      await repositories.auditLogs.create({
        actorLabel: 'local-admin',
        action: 'admin_approved_submission',
        targetType: 'community_submission',
        targetId: id,
        details: { note: body.note || 'Approved by admin.' }
      });
      return NextResponse.json({ ok: true, submission });
    }

    if (body.action === 'reject') {
      const submission = await repositories.submissions.reject({ submissionId: id, note: body.note || 'Rejected by admin.' });
      if (!submission) return jsonError('Submission not found.', 404);
      await repositories.auditLogs.create({
        actorLabel: 'local-admin',
        action: 'admin_rejected_submission',
        targetType: 'community_submission',
        targetId: id,
        details: { note: body.note || 'Rejected by admin.' }
      });
      return NextResponse.json({ ok: true, submission });
    }

    return jsonError('Action must be approve or reject.');
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to update submission.', 500);
  }
}
