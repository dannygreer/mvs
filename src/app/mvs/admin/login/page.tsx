import { redirect } from 'next/navigation';

// Legacy admin login URL preserved for bookmarks. Forwards to the unified
// Supabase magic-link login.
export default function AdminLoginRedirect() {
  redirect('/auth/login?next=/mvs/admin');
}
