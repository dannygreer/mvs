import Quiz from '@/components/quiz/Quiz';
import { getActiveScenario } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const scenario = await getActiveScenario();
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-white">
      <Quiz scenario={scenario} />
    </div>
  );
}
