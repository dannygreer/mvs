import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  // Refresh the Supabase session for every matched request.
  const { response, supabase } = await updateSession(request);

  if (request.nextUrl.pathname.startsWith('/mvs/admin')) {
    if (request.nextUrl.pathname === '/mvs/admin/login') {
      return response;
    }

    if (!supabase) {
      // Supabase env vars not provisioned — block /mvs/admin entirely.
      return NextResponse.redirect(
        new URL('/auth/login?next=/mvs/admin', request.url)
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const next = encodeURIComponent(request.nextUrl.pathname);
      return NextResponse.redirect(
        new URL(`/auth/login?next=${next}`, request.url)
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      // Authenticated but not super_admin — send them to their own portal.
      const dest =
        profile?.role === 'org_admin' ? '/org' : '/app';
      return NextResponse.redirect(new URL(dest, request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  // Match everything except static assets so Supabase sessions refresh
  // on real navigations but skip image/asset requests.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
