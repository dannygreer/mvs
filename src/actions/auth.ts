'use server';

import { createSession, deleteSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function adminLogin(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const expectedUsername = process.env.ADMIN_USERNAME ?? '';
  const expectedPassword = process.env.ADMIN_PASSWORD ?? '';

  if (!safeCompare(username, expectedUsername) || !safeCompare(password, expectedPassword)) {
    return { error: 'Invalid username or password' };
  }

  await createSession();
  redirect('/mvs/admin');
}

export async function adminLogout() {
  await deleteSession();
  redirect('/mvs/admin/login');
}
