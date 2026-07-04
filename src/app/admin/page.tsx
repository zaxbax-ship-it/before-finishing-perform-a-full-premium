import AdminPanel from '@/components/AdminPanel';
import data from '@/data/questions.json';
export default function Admin(){ return <AdminPanel questions={data.questions} />; }
