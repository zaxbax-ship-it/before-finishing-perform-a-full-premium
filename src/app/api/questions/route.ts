import { NextResponse } from 'next/server';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

export async function GET() {
  const repositories = getRepositoryProvider();
  const questions = await repositories.approvedQuestions.listGameplayQuestions({ activeOnly: true });
  return NextResponse.json({ ok: true, questions });
}
