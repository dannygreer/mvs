import { signOut } from '@/actions/session';
import { getCurrentProfile } from '@/lib/auth';
import { getOrg } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getCurrentProfile();
  const displayName = result?.profile.full_name ?? result?.user.email ?? '';
  const orgName = result?.profile.org_id
    ? (await getOrg(result.profile.org_id))?.name ?? ''
    : '';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Org Admin
            </p>
            <h1 className="text-base font-semibold text-zinc-900">{orgName}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">{displayName}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-zinc-500 hover:text-zinc-700 underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
