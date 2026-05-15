'use server';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth';
import { FROM_EMAIL, sendEmail } from '@/lib/email';

// Send pre-assessment invites for an org.
// One email per student (not per enrollment) — if a student has multiple
// 'pre' enrollments (e.g., scenario + multi-choice), the email lists all
// of their take URLs.
//
// Two modes:
//   - default: skip students whose 'pre' enrollments all have
//     invited_email_sent_at already populated.
//   - resend=true: include everyone with an incomplete 'pre' enrollment,
//     even if previously notified.
//
// Resend sandbox: only delivers to the email tied to your Resend account
// (see docs/needs_human.md). Real cohort sends require domain verification.

export type InviteEmailRow = {
  studentId: string;
  email: string | null;
  name: string | null;
  status: 'sent' | 'skipped_already_sent' | 'no_pending_enrollments' | 'no_email' | 'error';
  enrollmentCount: number;
  message?: string;
};

export type SendInvitesResult = {
  rows: InviteEmailRow[];
  sentCount: number;
  skippedCount: number;
  errorCount: number;
};

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

// Minimal HTML escaper for template interpolations. Inputs (firstName,
// orgName, assessment label) come from admin-controlled fields, so the
// practical risk is low — but a malicious org name like
// `<img src=x onerror=...>` would render in some clients without this.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInviteHtml(opts: {
  firstName: string;
  orgName: string;
  links: { label: string; url: string }[];
}): { subject: string; html: string; text: string } {
  const subject = `Your MVS pre-training assessment is ready`;
  const linksHtml = opts.links
    .map(
      (l) =>
        `<li style="margin: 12px 0;"><a href="${escapeHtml(l.url)}" style="color: #18181b; font-weight: 600;">${escapeHtml(l.label)}</a><br><span style="color: #71717a; font-size: 12px;">${escapeHtml(l.url)}</span></li>`
    )
    .join('');
  const linksText = opts.links.map((l) => `${l.label}\n${l.url}`).join('\n\n');

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">Hi ${escapeHtml(opts.firstName)},</h1>
  <p style="line-height: 1.5;">${escapeHtml(opts.orgName)} has enrolled you in the MVS pre-training assessment.</p>
  <p style="line-height: 1.5;">Take it from any device — laptop or phone — using the link${
    opts.links.length === 1 ? '' : 's'
  } below. About 5 minutes.</p>
  <ul style="list-style: none; padding: 0;">${linksHtml}</ul>
  <p style="color: #71717a; font-size: 12px; line-height: 1.5; margin-top: 32px;">
    No login required. Just click and start. The link is unique to you — please don't share it.
  </p>
</div>`.trim();

  const text = `Hi ${opts.firstName},

${opts.orgName} has enrolled you in the MVS pre-training assessment. About 5 minutes.

${linksText}

No login required. Just click and start. The link is unique to you.`;

  return { subject, html, text };
}

export async function sendPreInvites(
  _prev: SendInvitesResult | null,
  formData: FormData
): Promise<SendInvitesResult> {
  await requireSuperAdmin();

  const orgId = String(formData.get('orgId') ?? '').trim();
  const resendAll = formData.get('resendAll') === 'on';
  if (!orgId) throw new Error('orgId required');

  const admin = adminClient();
  const baseUrl = await getBaseUrl();

  // Org name for email body
  const { data: org } = await admin
    .from('orgs')
    .select('name')
    .eq('id', orgId)
    .single();
  const orgName = org?.name ?? 'Your organization';

  // Fetch all students in the org with their incomplete 'pre' enrollments.
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('org_id', orgId)
    .eq('role', 'student');

  if (!profiles || profiles.length === 0) {
    return { rows: [], sentCount: 0, skippedCount: 0, errorCount: 0 };
  }

  const studentIdSet = new Set(profiles.map((p) => p.id as string));

  // Get emails (auth.users via paginated admin SDK).
  const emailById = new Map<string, string | null>();
  let page = 1;
  while (emailById.size < studentIdSet.size && page <= 20) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 50 });
    if (!list || list.users.length === 0) break;
    for (const u of list.users) {
      if (studentIdSet.has(u.id)) emailById.set(u.id, u.email ?? null);
    }
    if (list.users.length < 50) break;
    page++;
  }

  // Pull 'pre' enrollments for these students with assessment + token.
  const { data: enrollments } = await admin
    .from('enrollments')
    .select(
      'id, student_id, secret_token, completed_at, invited_email_sent_at, assessments(code, name)'
    )
    .in('student_id', Array.from(studentIdSet))
    .eq('phase', 'pre');

  type EnrollmentLite = {
    id: string;
    student_id: string;
    secret_token: string;
    completed_at: string | null;
    invited_email_sent_at: string | null;
    assessments: { code: string; name: string } | null;
  };
  const byStudent = new Map<string, EnrollmentLite[]>();
  for (const e of (enrollments ?? []) as unknown as EnrollmentLite[]) {
    const arr = byStudent.get(e.student_id) ?? [];
    arr.push(e);
    byStudent.set(e.student_id, arr);
  }

  const rows: InviteEmailRow[] = [];

  for (const p of profiles) {
    const studentId = p.id as string;
    const fullName = (p.full_name as string | null) ?? '';
    const firstName = fullName.split(' ')[0] || 'there';
    const email = emailById.get(studentId) ?? null;
    const all = byStudent.get(studentId) ?? [];
    const pending = all.filter((e) => !e.completed_at);

    if (pending.length === 0) {
      rows.push({
        studentId,
        email,
        name: fullName || null,
        status: 'no_pending_enrollments',
        enrollmentCount: 0,
      });
      continue;
    }

    if (!resendAll && pending.every((e) => e.invited_email_sent_at)) {
      rows.push({
        studentId,
        email,
        name: fullName || null,
        status: 'skipped_already_sent',
        enrollmentCount: pending.length,
      });
      continue;
    }

    if (!email) {
      rows.push({
        studentId,
        email: null,
        name: fullName || null,
        status: 'no_email',
        enrollmentCount: pending.length,
      });
      continue;
    }

    const links = pending.map((e) => ({
      label: e.assessments?.name ?? e.assessments?.code ?? 'Assessment',
      url: `${baseUrl}/take/${e.secret_token}`,
    }));
    const { subject, html, text } = renderInviteHtml({
      firstName,
      orgName,
      links,
    });

    try {
      const { error: sendErr } = await sendEmail({
        from: FROM_EMAIL,
        to: email,
        subject,
        html,
        text,
      });
      if (sendErr) {
        rows.push({
          studentId,
          email,
          name: fullName || null,
          status: 'error',
          enrollmentCount: pending.length,
          message: sendErr.message,
        });
        continue;
      }

      const ids = pending.map((e) => e.id);
      await admin
        .from('enrollments')
        .update({ invited_email_sent_at: new Date().toISOString() })
        .in('id', ids);

      rows.push({
        studentId,
        email,
        name: fullName || null,
        status: 'sent',
        enrollmentCount: pending.length,
      });
    } catch (e) {
      rows.push({
        studentId,
        email,
        name: fullName || null,
        status: 'error',
        enrollmentCount: pending.length,
        message: e instanceof Error ? e.message : 'Send failed',
      });
    }
  }

  revalidatePath(`/mvs/admin/orgs/${orgId}`);

  const sentCount = rows.filter((r) => r.status === 'sent').length;
  const skippedCount = rows.filter(
    (r) => r.status === 'skipped_already_sent' || r.status === 'no_pending_enrollments'
  ).length;
  const errorCount = rows.filter(
    (r) => r.status === 'error' || r.status === 'no_email'
  ).length;
  return { rows, sentCount, skippedCount, errorCount };
}
