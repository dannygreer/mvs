import { signOut } from '@/actions/session';
import { getCurrentProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getCurrentProfile();
  const displayName = result?.profile.full_name ?? result?.user.email ?? '';

  // Transparent wrapper so the shared PhaseLanding backdrop (and each
  // take page's own surface) shows through. Dark chrome to match the
  // marketing-themed student landing.
  return (
    <div className="mvs-body min-h-screen flex flex-col">
      <header className="relative z-20 border-b border-zinc-800/60 bg-zinc-950/40 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-end gap-4 text-sm">
          <span className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500">
            {displayName}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
