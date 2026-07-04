import TriviaPlatform from '@/components/TriviaPlatform';
import { createTriviaDataService } from '@/lib/services/triviaDataService';

export default async function Home(){
  const data = await createTriviaDataService().getPageData();
  return <TriviaPlatform questions={data.questions} />;
}
