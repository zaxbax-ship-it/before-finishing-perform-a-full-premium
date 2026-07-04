import { NextResponse } from 'next/server';
import { createAudit } from '@/lib/community';
import type { CommunityDraft } from '@/lib/community';
import { createAiModerationService } from '@/lib/ai/moderation/service';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { submissionToQuestion } from '@/lib/community';
import { hashIdentity, internalServerError, publicJsonError, readLimitedJson, redactSubmissionForClient } from '@/lib/api/communitySecurity';

export async function GET() {
  try {
    const repositories = getRepositoryProvider();
    const [submissions, auditLogs] = await Promise.all([
      repositories.submissions.list({ limit: 200 }),
      repositories.auditLogs.list({ limit: 80 })
    ]);
    return NextResponse.json({ ok: true, provider: repositories.kind, submissions: submissions.map(redactSubmissionForClient), auditLogs });
  } catch (error) {
    return internalServerError('community-submissions:get', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readLimitedJson<{ draft?: CommunityDraft }>(request);
    if (!body.draft) return publicJsonError('Missing submission draft.');

    const repositories = getRepositoryProvider();
    const [existingQuestions, existingSubmissions] = await Promise.all([
      repositories.approvedQuestions.listGameplayQuestions({ activeOnly: true, limit: 800 }),
      repositories.submissions.list({ limit: 300 })
    ]);

    const ai = await createAiModerationService().moderate({
      draft: body.draft,
      existingQuestions,
      existingSubmissions
    });

    const submission = await repositories.submissions.create({
      draft: {
        ...body.draft,
        question: body.draft.question.trim(),
        options: body.draft.options.map(option => option.trim()),
        explanation: ai.explanation,
        contributorEmail: body.draft.contributorEmail.trim().toLowerCase(),
        contributorName: body.draft.contributorName.trim()
      },
      moderation: ai.moderation
    });

    await repositories.moderationResults.create(submission.id, ai.moderation);

    if (ai.moderation.status === 'auto_approved') {
      const question = submission.question || submissionToQuestion({ ...submission, moderation: ai.moderation });
      await repositories.approvedQuestions.create({
        ...question,
        sourceSubmissionId: submission.id,
        locale: submission.draft.language,
        isActive: true,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    if (ai.qualitySignals.spamRisk >= 65 || ai.qualitySignals.unsafeRisk >= 65) {
      await repositories.antiSpamEvents.create({
        eventType: ai.qualitySignals.unsafeRisk >= 65 ? 'toxic_content' : 'manual_flag',
        submissionId: submission.id,
        emailHash: hashIdentity(submission.draft.contributorEmail),
        severity: Math.max(ai.qualitySignals.spamRisk, ai.qualitySignals.unsafeRisk),
        details: ai.qualitySignals
      });
    }

    const audit = await repositories.auditLogs.create({
      actorLabel: submission.draft.contributorEmail || submission.draft.contributorName || 'community-user',
      action: 'ai_moderated_submission',
      targetType: 'community_submission',
      targetId: submission.id,
      details: {
        provider: ai.provider,
        recommendation: ai.recommendation,
        confidence: ai.confidence,
        status: ai.moderation.status
      }
    });

    return NextResponse.json({ ok: true, provider: repositories.kind, submission: redactSubmissionForClient(submission), auditLog: audit, ai });
  } catch (error) {
    const audit = createAudit('ai_moderation_failed', 'community_submission', error instanceof Error ? error.message : 'Unknown moderation error');
    return internalServerError('community-submissions:post', audit.details);
  }
}
