import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Returns the authenticated user + role if super_admin, otherwise null.
// Use this from server actions and route handlers to guard admin-only paths.
// /mvs/admin proxy already enforces the same check, so this is defense-in-depth
// for non-/mvs/admin entry points (e.g. /api/admin/export-csv).
//
// Wrapped in React `cache()` so that within a single request, multiple
// callers (proxy + page + nested server components + server actions) share
// one promise — saves duplicate auth.getUser + profiles.select roundtrips.
export const getSuperAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') return null;
  return { user, role: profile.role as 'super_admin' };
});

export async function requireSuperAdmin() {
  const result = await getSuperAdmin();
  if (!result) throw new Error('Unauthorized');
  return result;
}

// Returns the authenticated user + their profile (role + name), or null if
// no session. Use for student-portal entry points.
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, org_id')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return {
    user,
    profile: {
      role: profile.role as 'super_admin' | 'org_admin' | 'student',
      full_name: profile.full_name as string | null,
      org_id: profile.org_id as string | null,
    },
  };
}

// Server helper for /app routes. Redirects:
//   - no session → /auth/login?next=<current path>
//   - super_admin → /mvs/admin (their portal)
//   - org_admin → /org (placeholder until Day 6)
// Returns the user + profile when role === 'student'.
// Server helper for /org routes. Redirects:
//   - no session → /auth/login?next=<current path>
//   - super_admin → /mvs/admin
//   - student → /app
// Returns user + profile when role === 'org_admin'.
export async function requireOrgAdmin(currentPath: string = '/org') {
  const result = await getCurrentProfile();
  if (!result) {
    redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);
  }
  if (result.profile.role === 'super_admin') redirect('/mvs/admin');
  if (result.profile.role === 'student') redirect('/app');
  // Defense-in-depth allowlist: anything that isn't org_admin gets bounced.
  // The CHECK constraint on profiles.role currently makes this unreachable,
  // but if the constraint is ever relaxed an unknown role would otherwise
  // fall through and gain /org access.
  if (result.profile.role !== 'org_admin') {
    redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);
  }
  return result;
}

export async function requireStudent(currentPath: string = '/app') {
  const result = await getCurrentProfile();
  if (!result) {
    redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);
  }
  if (result.profile.role === 'super_admin') {
    redirect('/mvs/admin');
  }
  if (result.profile.role === 'org_admin') {
    redirect('/org');
  }
  return result;
}
