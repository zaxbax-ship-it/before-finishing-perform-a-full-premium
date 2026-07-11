import { NextResponse } from 'next/server';
import { createAudit } from '@/lib/community';
import type { CommunityDraft } from '@/lib/community';
import type { Locale } from '@/lib/types';
import { createAiModerationService } from '@/lib/ai/moderation/service';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { guardApiPermission } from '@/lib/auth/guards';
import { getClientIdentity, internalServerError, publicJsonError, readLimitedJson, redactSubmissionForClient } from '@/lib/api/communitySecurity';
import { checkRateLimit, getAiModerationRateLimit, getCommunitySubmissionRateLimit } from '@/lib/infrastructure/rateLimit';

const LOCALES: Locale[] = ['he', 'en', 'ar', 'ru'];

// Reading the moderation queue and audit logs is an admin-only capability.
export async function GET() {
  const guard = await guardApiPermission('submissions.read');
  if (!guard.ok) return guard.response;

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

/**
 * Stage 11 — low-friction community submission. The contributor provides ONLY a
 * question and its correct answer. The AI editorial pipeline then prepares a
 * complete, game-ready question (improved wording, three generated wrong answers,
 * category, difficulty, duplicate + confidence scoring, recommendation). The
 * submission is stored as `needs_review` and NEVER auto-published — a human
 * admin must approve it before it can enter the live game.
 */
export async function POST(request: Request) {
  try {
    const repositories = getRepositoryProvider();
    const client = getClientIdentity(request);
    const body = await readLimitedJson<{ question?: unknown; correctAnswer?: unknown; language?: unknown }>(request);

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const correctAnswer = typeof body.correctAnswer === 'string' ? body.correctAnswer.trim() : '';
    const language: Locale = LOCALES.includes(body.language as Locale) ? (body.language as Locale) : 'he';
    if (!question || !correctAnswer) return publicJsonError('A question and a correct answer are required.');

    // Rate limiting is keyed by device only (no email is collected any more).
    const contributorId = client.ipHash || 'anonymous';
    const submitLimit = getCommunitySubmissionRateLimit();
    const submissionRate = await checkRateLimit({ key: `community-submission:${contributorId}`, ...submitLimit });
    if (!submissionRate.allowed) {
      await repositories.antiSpamEvents.create({
        eventType: 'rate_limit', ipHash: client.ipHash, userAgentHash: client.userAgentHash, severity: 75,
        details: { scope: 'community_submission', retryAfterSeconds: submissionRate.retryAfterSeconds, resetAt: submissionRate.resetAt }
      });
      return NextResponse.json({ ok: false, error: 'Too many submissions. Please wait before trying again.' }, { status: 429, headers: { 'Retry-After': String(submissionRate.retryAfterSeconds) } });
    }

    const aiLimit = getAiModerationRateLimit();
    const aiRate = await checkRateLimit({ key: `ai-moderation:${contributorId}`, ...aiLimit });
    if (!aiRate.allowed) {
      return NextResponse.json({ ok: false, error: 'The editor is busy. Please wait a moment before submitting another question.' }, { status: 429, headers: { 'Retry-After': String(aiRate.retryAfterSeconds) } });
    }

    const [existingQuestions, existingSubmissions] = await Promise.all([
      repositories.approvedQuestions.listGameplayQuestions({ activeOnly: true, limit: 800 }),
      repositories.submissions.list({ limit: 300 })
    ]);

    // Seed draft: the AI fills the three wrong options, the category and difficulty.
    const seedDraft: CommunityDraft = {
      question,
      options: [correctAnswer, '', '', ''],
      correctIndex: 0,
      category: '',
      difficulty: '',
      language,
      explanation: '',
      contributorName: '',
      contributorEmail: '',
      contributorId
    };

    const ai = await createAiModerationService().moderate({ draft: seedDraft, existingQuestions, existingSubmissions });

    // The AI never publishes; the stored status is always review-gated.
    const moderation = { ...ai.moderation, status: 'needs_review' as const };
    const gameReadyDraft: CommunityDraft = {
      ...seedDraft,
      question: ai.improvedQuestion,
      options: ai.improvedOptions,
      correctIndex: ai.correctIndex,
      category: ai.category,
      difficulty: ai.difficulty,
      explanation: ai.explanation
    };

    const submission = await repositories.submissions.create({
      draft: gameReadyDraft,
      moderation,
      ipHash: client.ipHash,
      userAgentHash: client.userAgentHash
    });
    await repositories.moderationResults.create(submission.id, moderation);

    // Future-ready contributor reputation (architecture only — no points yet).
    try {
      await repositories.reputation.addEvent({ contributorId, submissionId: submission.id, delta: 0, reason: 'submitted' });
    } catch { /* reputation is a non-blocking future feature */ }

    if (ai.qualitySignals.spamRisk >= 65 || ai.qualitySignals.unsafeRisk >= 65) {
      await repositories.antiSpamEvents.create({
        eventType: ai.qualitySignals.unsafeRisk >= 65 ? 'toxic_content' : 'manual_flag',
        submissionId: submission.id, severity: Math.max(ai.qualitySignals.spamRisk, ai.qualitySignals.unsafeRisk), details: ai.qualitySignals
      });
    }

    await repositories.auditLogs.create({
      actorLabel: 'community-contributor',
      action: 'ai_prepared_submission',
      targetType: 'community_submission',
      targetId: submission.id,
      details: {
        provider: ai.provider, recommendation: ai.recommendation, confidence: ai.confidence,
        category: ai.category, difficulty: ai.difficulty, duplicateRisk: ai.qualitySignals.duplicateRisk, factCheck: ai.factCheck.status
      }
    });

    // The contributor only learns the submission was received and is under review.
    return NextResponse.json({ ok: true, status: 'received' });
  } catch (error) {
    const audit = createAudit('ai_moderation_failed', 'community_submission', error instanceof Error ? error.message : 'Unknown moderation error');
    return internalServerError('community-submissions:post', audit.details);
  }
}
