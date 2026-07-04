import TriviaPlatform from '@/components/TriviaPlatform';
import data from '@/data/questions.json';
export default function Admin(){ return <TriviaPlatform questions={data.questions} initialScreen="admin" />; }
