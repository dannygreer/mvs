// Temporary site-wide password gate. While in effect, every page (marketing,
// admin, student, etc.) requires the `mvs_access` cookie. The cookie is set
// by this page's server action; it lives 24 hours.
//
// Once the client demo period ends, delete this page + remove the gate block
// in `src/proxy.ts`.
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const SITE_PASSWORD = process.env.SITE_PASSWORD ?? 'mvs!pass';
const COOKIE_NAME = 'mvs_access';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

async function submitPassword(formData: FormData) {
  'use server';
  const supplied = (formData.get('password') as string | null)?.trim() ?? '';
  const next =
    ((formData.get('next') as string | null) ?? '/').toString() || '/';
  // Only allow same-origin redirects to avoid open-redirect chaining.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (supplied !== SITE_PASSWORD) {
    redirect(`/password?next=${encodeURIComponent(safeNext)}&error=1`);
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  redirect(safeNext);
}

export default async function PasswordGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '/', error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 mvs-body px-6">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)] pointer-events-none"
        aria-hidden="true"
      />
      <form
        action={submitPassword}
        className="relative w-full max-w-sm"
      >
        <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#4FA9F0]" />
        <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#4FA9F0]" />
        <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#4FA9F0]" />
        <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#4FA9F0]" />
        <div
          className="bg-zinc-950/70 backdrop-blur-md p-8 space-y-6"
          style={{
            border: '1px solid rgba(1,111,212,0.45)',
            boxShadow:
              'inset 0 0 30px rgba(1,111,212,0.06), 0 0 60px rgba(1,111,212,0.10)',
          }}
        >
          <div>
            <p className="mvs-mono text-[10px] uppercase tracking-[0.3em] text-[#4FA9F0] mb-2">
              Restricted access
            </p>
            <h1 className="mvs-display text-3xl font-bold uppercase tracking-wide text-zinc-100">
              Authorization required
            </h1>
            <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-400 mt-2">
              Enter access code to continue
            </p>
          </div>

          <input type="hidden" name="next" value={next} />
          <div>
            <label
              htmlFor="password"
              className="mvs-mono block text-[10px] font-semibold text-[#4FA9F0] uppercase tracking-[0.25em] mb-2"
            >
              Access Code
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="mvs-mono w-full px-4 py-3 bg-zinc-950/60 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:bg-zinc-950 transition-colors"
              style={{ border: '1px solid rgba(1,111,212,0.30)', borderRadius: 0 }}
              placeholder="••••••••••••"
            />
          </div>

          {error && (
            <p className="mvs-mono text-xs uppercase tracking-widest text-red-400">
              Invalid access code
            </p>
          )}

          <button
            type="submit"
            className="mvs-mono w-full px-8 py-3 text-sm uppercase tracking-[0.25em] text-[#4FA9F0] hover:text-white hover:bg-[#016FD4] transition-colors"
            style={{
              border: '1px solid rgba(1,111,212,0.55)',
              borderRadius: 0,
              boxShadow: '0 0 24px rgba(1,111,212,0.20)',
            }}
          >
            Authenticate ›
          </button>

          <p className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 text-center">
            Access cookie valid 24 hours
          </p>
        </div>
      </form>
    </div>
  );
}
