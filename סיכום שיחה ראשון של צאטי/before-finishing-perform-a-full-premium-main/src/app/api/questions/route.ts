import { NextResponse } from 'next/server';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { listGameplayQuestionsWithBundledFallback } from '@/lib/services/gameplayQuestionSource';

export async function GET() {
  const repositories = getRepositoryProvider();
  const questions = await listGameplayQuestionsWithBundledFallback(repositories, { activeOnly: true }, 'questions_api');
  return NextResponse.json({ ok: true, questions }, { headers: { 'Cache-Control': 'no-store' } });
}
