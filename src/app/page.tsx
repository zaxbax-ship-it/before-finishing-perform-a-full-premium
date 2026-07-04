import TriviaPlatform from '@/components/TriviaPlatform';
import data from '@/data/questions.json';
export default function Home(){ return <TriviaPlatform questions={data.questions} />; }
