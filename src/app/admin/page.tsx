import { redirect } from 'next/navigation';
import TriviaPlatform from '@/components/TriviaPlatform';
import { createTriviaDataService } from '@/lib/services/triviaDataService';
import { API_QUESTION_SAMPLE_SIZE } from '@/lib/services/questionSampling';
import { enforcementActive, requirePermission } from '@/lib/auth/guards';
import { AuthorizationError, type AdminContext } from '@/lib/auth/types';
import AdminAuthBar from './AdminAuthBar';

// The admin dashboard must never be statically cached — the authorization guard
// has to run on every request so enforcement cannot be bypassed by a prerender.
export const dynamic = 'force-dynamic';

export default async function Admin() {
  let context: AdminContext | undefined;

  if (enforcementActive()) {
    try {
      context = await requirePermission('submissions.read');
    } catch (error) {
      if (error instanceof AuthorizationError) {
        redirect(error.status === 401 ? '/login?redirect=/admin' : '/forbidden');
      }
      throw error;
    }
  }

  const data = await createTriviaDataService().getPageData({ sampleSize: API_QUESTION_SAMPLE_SIZE });

  return (
    <TriviaPlatform
      questions={data.questions}
      totalAvailableQuestions={data.totalAvailableQuestions}
      initialScreen="admin"
      adminHeader={context ? <AdminAuthBar context={context} /> : null}
    />
  );
}
