import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { signOut } from '@/actions/session';

export const dynamic = 'force-dynamic';

// Day 3 placeholder. Day 4 lights this up with the student's enrollments.
export default async function StudentHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/app');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-8 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Welcome to MVS</h1>
        <p className="text-zinc-600">
          Your assessments will appear here once they&apos;re assigned.
        </p>
        <p className="text-xs text-zinc-400">Signed in as {user.email}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-700 underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
