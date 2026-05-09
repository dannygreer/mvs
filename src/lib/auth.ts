import { createClient } from '@/lib/supabase/server';

// Returns the authenticated user + role if super_admin, otherwise null.
// Use this from server actions and route handlers to guard admin-only paths.
// /mvs/admin proxy already enforces the same check, so this is defense-in-depth
// for non-/mvs/admin entry points (e.g. /api/admin/export-csv).
export async function getSuperAdmin() {
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
}

export async function requireSuperAdmin() {
  const result = await getSuperAdmin();
  if (!result) throw new Error('Unauthorized');
  return result;
}
