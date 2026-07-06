import TriviaPlatform from '@/components/TriviaPlatform';
import { createTriviaDataService } from '@/lib/services/triviaDataService';

export const dynamic = 'force-dynamic';

export default async function Home(){
  const data = await createTriviaDataService().getPageData({ allowBundledFallback: true });
  return <TriviaPlatform questions={data.questions} totalAvailableQuestions={data.totalAvailableQuestions} />;
}
