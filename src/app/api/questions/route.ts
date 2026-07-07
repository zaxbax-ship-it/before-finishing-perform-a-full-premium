import { NextResponse } from 'next/server';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { listGameplayQuestionsWithBundledFallback } from '@/lib/services/gameplayQuestionSource';
import { API_QUESTION_SAMPLE_SIZE, balancedQuestionSample, clampQuestionLimit, parseQuestionExcludeParam } from '@/lib/services/questionSampling';
import type { QuestionsResponse } from '@/lib/api/contracts';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || undefined;
  const difficulty = url.searchParams.get('difficulty') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const limit = clampQuestionLimit(url.searchParams.get('limit'));
  const sampled = url.searchParams.get('sample') !== 'false';
  const excludeIds = parseQuestionExcludeParam(url.searchParams.get('exclude'));
  const repositories = getRepositoryProvider();
  const questions = await listGameplayQuestionsWithBundledFallback(
    repositories,
    {
      activeOnly: true,
      category,
      difficulty,
      search,
      limit: sampled ? undefined : limit
    },
    'questions_api'
  );
  const sampleLimit = Math.min(limit, category || difficulty || search ? limit : API_QUESTION_SAMPLE_SIZE);
  const responseQuestions = sampled
    ? balancedQuestionSample(questions, sampleLimit, { excludeIds })
    : questions.filter(question => !excludeIds.includes(String(question.id))).slice(0, limit);
  const safeResponseQuestions = responseQuestions.length > 0
    ? responseQuestions
    : questions.slice(0, limit);
  return NextResponse.json(
    {
      ok: true,
      questions: safeResponseQuestions,
      totalAvailable: questions.length,
      sampled,
      excludedApplied: excludeIds.length
    } satisfies QuestionsResponse,
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
