'use server';

import { createClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from '@/lib/auth';
import {
  insertOrg,
  updateOrgRow,
  type OrgInput,
} from '@/lib/db';
import { decideInviteAction } from '@/lib/invites';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const STATUSES = ['lead', 'active', 'completed', 'churned'] as const;
type Status = (typeof STATUSES)[number];

function parseStatus(raw: FormDataEntryValue | null): Status {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return (STATUSES as readonly string[]).includes(s) ? (s as Status) : 'lead';
}

function parseDealValue(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const dollars = Number(raw.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

function parseInput(formData: FormData): OrgInput {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Name is required');
  const rawSession = String(formData.get('session_date') ?? '').trim();
  // <input type="date"> emits YYYY-MM-DD already; empty string -> null.
  const sessionDate = rawSession === '' ? null : rawSession;
  return {
    name,
    type: (String(formData.get('type') ?? '').trim() || null),
    contact_name: (String(formData.get('contact_name') ?? '').trim() || null),
    contact_email: (String(formData.get('contact_email') ?? '').trim() || null),
    status: parseStatus(formData.get('status')),
    deal_value_cents: parseDealValue(formData.get('deal_value')),
    notes: (String(formData.get('notes') ?? '').trim() || null),
    session_date: sessionDate,
  };
}

export async function createOrg(formData: FormData) {
  await requireSuperAdmin();
  const input = parseInput(formData);
  const org = await insertOrg(input);
  revalidatePath('/mvs/admin/orgs');
  redirect(`/mvs/admin/orgs/${org.id}`);
}

export async function updateOrg(id: string, formData: FormData) {
  await requireSuperAdmin();
  const input = parseInput(formData);
  await updateOrgRow(id, input);
  revalidatePath('/mvs/admin/orgs');
  revalidatePath(`/mvs/admin/orgs/${id}`);
}

// ============================================================
// INVITE ORG ADMIN (single)
// ============================================================

export type InviteOrgAdminResult =
  | {
      status:
        | 'invited'
        | 'already_admin'
        | 'promoted_student';
      message?: string;
    }
  | {
      status: 'conflict_other_org' | 'super_admin_protected' | 'error';
      message: string;
    };

export async function inviteOrgAdmin(
  _prev: InviteOrgAdminResult | null,
  formData: FormData
): Promise<InviteOrgAdminResult> {
  await requireSuperAdmin();

  const orgId = String(formData.get('orgId') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();

  if (!orgId) return { status: 'error', message: 'orgId required' };
  if (!fullName) return { status: 'error', message: 'Full name required' };
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Invalid email format' };
  }

  const client = adminClient();
  let userId: string | null = null;
  let invited = false;

  const { data: inviteData, error: inviteErr } =
    await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getAppUrl()}/auth/callback?next=/org`,
      data: { full_name: fullName },
    });

  if (inviteErr) {
    const msg = inviteErr.message ?? '';
    if (
      /already registered/i.test(msg) ||
      /already exists/i.test(msg) ||
      inviteErr.status === 422
    ) {
      userId = await findUserByEmail(client, email);
      if (!userId) {
        return {
          status: 'error',
          message: `Existing user lookup failed: ${msg}`,
        };
      }
    } else {
      return { status: 'error', message: msg };
    }
  } else {
    userId = inviteData?.user?.id ?? null;
    invited = true;
    if (!userId) {
      return { status: 'error', message: 'Invite returned no user id' };
    }
  }

  const { data: existing } = await client
    .from('profiles')
    .select('org_id, role, full_name')
    .eq('id', userId)
    .single();

  if (existing?.role === 'super_admin') {
    return {
      status: 'super_admin_protected',
      message: 'Cannot demote a super_admin via this UI.',
    };
  }
  if (existing?.org_id && existing.org_id !== orgId) {
    return {
      status: 'conflict_other_org',
      message: `User already belongs to another org (${existing.org_id})`,
    };
  }

  const { error: upErr } = await client.from('profiles').upsert(
    {
      id: userId,
      role: 'org_admin',
      org_id: orgId,
      full_name: existing?.full_name ?? fullName,
    },
    { onConflict: 'id' }
  );
  if (upErr) {
    return { status: 'error', message: `Profile update failed: ${upErr.message}` };
  }

  revalidatePath(`/mvs/admin/orgs/${orgId}`);

  if (existing?.role === 'org_admin' && existing.org_id === orgId) {
    return {
      status: 'already_admin',
      message: 'User is already an admin of this org.',
    };
  }
  // Surface a distinct status when we promoted an existing student (vs.
  // created a new admin from scratch). Doctor may not expect a quiet
  // role change for someone already on the roster.
  if (existing?.role === 'student' && existing.org_id === orgId) {
    return {
      status: 'promoted_student',
      message:
        'Existing student in this org was promoted to org_admin. Confirm this was intended.',
    };
  }
  return {
    status: 'invited',
    message: invited ? 'Invite email sent.' : 'Existing user promoted to org_admin.',
  };
}

// ============================================================
// BULK INVITE STUDENTS
// ============================================================

export type InviteRowResult = {
  line: number;
  raw: string;
  email?: string;
  status:
    | 'invited'
    | 'already_exists_added_to_org'
    | 'already_in_this_org'
    | 'conflict_other_org'
    | 'parse_error'
    | 'error';
  message?: string;
};

export type InviteResult = {
  rows: InviteRowResult[];
  invitedCount: number;
  conflictCount: number;
  errorCount: number;
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_ROSTER_ROWS = 200;

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function findUserByEmail(
  client: ReturnType<typeof adminClient>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data) return null;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

export async function inviteStudents(
  _prev: InviteResult | null,
  formData: FormData
): Promise<InviteResult> {
  await requireSuperAdmin();

  const orgId = String(formData.get('orgId') ?? '').trim();
  const raw = String(formData.get('roster') ?? '');
  if (!orgId) {
    return {
      rows: [],
      invitedCount: 0,
      conflictCount: 0,
      errorCount: 1,
    };
  }

  const client = adminClient();
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const rows: InviteRowResult[] = [];

  // Vercel functions cap at 300s and the per-row work is sequential
  // (auth.admin.inviteUserByEmail + profile upsert ~ a few hundred ms each,
  // worse on conflict because we paginate listUsers). 200 rows is a safe
  // ceiling for v1 cohort scale; raise once we have a real index for
  // email -> user_id lookups.
  const nonBlank = lines.filter((l) => l.trim() !== '').length;
  if (nonBlank > MAX_ROSTER_ROWS) {
    return {
      rows: [
        {
          line: 0,
          raw: '',
          status: 'error',
          message: `Too many rows (${nonBlank}). Max ${MAX_ROSTER_ROWS} per submission. Split into batches.`,
        },
      ],
      invitedCount: 0,
      conflictCount: 0,
      errorCount: 1,
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    if (line === '') continue;

    const parts = line.split(',').map((s) => s.trim());
    if (parts.length !== 3) {
      rows.push({
        line: lineNo,
        raw: line,
        status: 'parse_error',
        message: 'Expected 3 comma-separated fields: First,Last,email',
      });
      continue;
    }
    const [first, last, email] = parts;
    if (!first || !last || !email) {
      rows.push({
        line: lineNo,
        raw: line,
        status: 'parse_error',
        message: 'First, Last, and email are all required',
      });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      rows.push({
        line: lineNo,
        raw: line,
        email,
        status: 'parse_error',
        message: 'Invalid email format',
      });
      continue;
    }

    const fullName = `${first} ${last}`;
    const redirectTo = `${getAppUrl()}/auth/callback?next=/app`;

    let userId: string | null = null;
    let invited = false;

    const { data: inviteData, error: inviteErr } =
      await client.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName },
      });

    if (inviteErr) {
      // Already-registered users return "User already registered" or 422.
      const msg = inviteErr.message ?? '';
      if (
        /already registered/i.test(msg) ||
        /already exists/i.test(msg) ||
        inviteErr.status === 422
      ) {
        userId = await findUserByEmail(client, email);
        if (!userId) {
          rows.push({
            line: lineNo,
            raw: line,
            email,
            status: 'error',
            message: `Existing user lookup failed: ${msg}`,
          });
          continue;
        }
      } else {
        rows.push({
          line: lineNo,
          raw: line,
          email,
          status: 'error',
          message: msg,
        });
        continue;
      }
    } else {
      userId = inviteData?.user?.id ?? null;
      invited = true;
      if (!userId) {
        rows.push({
          line: lineNo,
          raw: line,
          email,
          status: 'error',
          message: 'Invite returned no user id',
        });
        continue;
      }
    }

    // Trigger from 0002 should have created the profile row. Defensive upsert
    // just in case the trigger lagged or this is an existing user.
    const { data: existing } = await client
      .from('profiles')
      .select('org_id, full_name')
      .eq('id', userId)
      .single();

    const decision = decideInviteAction(
      existing ? { org_id: existing.org_id } : null,
      orgId
    );

    if (decision.kind === 'conflict_other_org') {
      rows.push({
        line: lineNo,
        raw: line,
        email,
        status: 'conflict_other_org',
        message: `User already belongs to another org (${decision.currentOrgId})`,
      });
      continue;
    }

    const updates: { org_id: string; full_name?: string } = { org_id: orgId };
    if (!existing?.full_name) updates.full_name = fullName;

    const { error: upErr } = await client
      .from('profiles')
      .upsert({ id: userId, role: 'student', ...updates }, { onConflict: 'id' });

    if (upErr) {
      rows.push({
        line: lineNo,
        raw: line,
        email,
        status: 'error',
        message: `Profile update failed: ${upErr.message}`,
      });
      continue;
    }

    rows.push({
      line: lineNo,
      raw: line,
      email,
      status: invited
        ? 'invited'
        : decision.kind === 'already_in_this_org'
        ? 'already_in_this_org'
        : 'already_exists_added_to_org',
    });
  }

  const invitedCount = rows.filter((r) => r.status === 'invited').length;
  const conflictCount = rows.filter(
    (r) => r.status === 'conflict_other_org'
  ).length;
  const errorCount = rows.filter(
    (r) => r.status === 'error' || r.status === 'parse_error'
  ).length;

  revalidatePath(`/mvs/admin/orgs/${orgId}`);

  return { rows, invitedCount, conflictCount, errorCount };
}

// ============================================================
// USER MANAGEMENT — corrective / destructive ops on orgs + roster
// ============================================================
//
// All five are super_admin-gated. Self-protection on destructive ops
// (caller cannot delete/demote themselves). super_admin role targets are
// rejected to prevent stepping-on-toes mistakes — the rare super_admin
// promotion/demotion remains a SQL-only operation per docs/needs_human.md.

export async function deleteOrg(orgId: string): Promise<void> {
  await requireSuperAdmin();
  const client = adminClient();

  // Empty-roster guard. Any profile with org_id === orgId, even an org_admin,
  // blocks the delete. Caller must first remove students / demote admins.
  const { data: existing, error: countErr } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if (countErr) throw new Error(`Roster check failed: ${countErr.message}`);
  // .head=true returns null for data but populates count via response header;
  // supabase-js exposes it on the result. Re-query for clarity:
  void existing;
  const { count } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if ((count ?? 0) > 0) {
    throw new Error(
      'Cannot delete org while roster is non-empty. Remove or reassign all profiles first.',
    );
  }

  const { error } = await client.from('orgs').delete().eq('id', orgId);
  if (error) throw new Error(`Org delete failed: ${error.message}`);

  revalidatePath('/mvs/admin/orgs');
}

// Nuclear option. Deletes EVERY auth.users row attached to the org
// (cascades drop profiles + enrollments; responses keep their data with
// student_id flipped to NULL) then deletes the org row itself.
//
// Refuses if any super_admin or the calling super_admin is in the
// roster — those cases require a SQL intervention.
export async function forceDeleteOrg(orgId: string): Promise<void> {
  const { user: caller } = await requireSuperAdmin();
  const client = adminClient();

  const { data: members, error: rosterErr } = await client
    .from('profiles')
    .select('id, role')
    .eq('org_id', orgId);
  if (rosterErr) throw new Error(`Roster lookup failed: ${rosterErr.message}`);

  for (const m of members ?? []) {
    if (m.id === caller.id) {
      throw new Error('Refusing to delete an org you belong to.');
    }
    if (m.role === 'super_admin') {
      throw new Error(
        'Cannot force-delete an org that contains a super_admin. Resolve that account in SQL first.',
      );
    }
  }

  // Delete every auth user; cascade handles profiles + enrollments.
  for (const m of members ?? []) {
    const { error } = await client.auth.admin.deleteUser(m.id);
    if (error) {
      throw new Error(
        `Member delete failed for ${m.id}: ${error.message}. Org row was NOT deleted; rerun once resolved.`,
      );
    }
  }

  const { error: orgErr } = await client.from('orgs').delete().eq('id', orgId);
  if (orgErr) throw new Error(`Org delete failed: ${orgErr.message}`);

  revalidatePath('/mvs/admin/orgs');
}

// Force orgs.status back to 'active'. Useful when an org has been marked
// 'churned' or 'completed' (manually or via a future disable flow) and the
// super_admin wants to bring it back into the active list with one click.
export async function reenableOrg(orgId: string): Promise<void> {
  await requireSuperAdmin();
  const client = adminClient();
  const { error } = await client
    .from('orgs')
    .update({ status: 'active' })
    .eq('id', orgId);
  if (error) throw new Error(`Re-enable failed: ${error.message}`);

  revalidatePath('/mvs/admin/orgs');
  revalidatePath(`/mvs/admin/orgs/${orgId}`);
}

export async function removeStudentFromOrg(
  orgId: string,
  studentId: string,
): Promise<void> {
  const { user: caller } = await requireSuperAdmin();
  if (caller.id === studentId) {
    throw new Error('Cannot remove yourself from an org via this UI.');
  }
  const client = adminClient();
  const { error } = await client
    .from('profiles')
    .update({ org_id: null })
    .eq('id', studentId)
    .eq('org_id', orgId);
  if (error) throw new Error(`Unlink failed: ${error.message}`);

  revalidatePath('/mvs/admin/orgs');
  revalidatePath(`/mvs/admin/orgs/${orgId}`);
}

// Hard delete: removes the auth.users row. Cascades drop profiles +
// enrollments. responses_long.student_id and responses_wide.student_id
// flip to NULL (audit data survives anonymized) per the existing FKs.
export async function deleteStudent(studentId: string): Promise<void> {
  const { user: caller } = await requireSuperAdmin();
  if (caller.id === studentId) {
    throw new Error('Cannot delete your own account via this UI.');
  }
  const client = adminClient();

  // Super_admin protection — refuse to delete any other super_admin from
  // the UI. (Demoting/removing a super_admin remains a SQL operation.)
  const { data: profile } = await client
    .from('profiles')
    .select('role')
    .eq('id', studentId)
    .single();
  if (profile?.role === 'super_admin') {
    throw new Error(
      'Cannot delete a super_admin via this UI. Use SQL if intentional.',
    );
  }

  const { error } = await client.auth.admin.deleteUser(studentId);
  if (error) throw new Error(`Account delete failed: ${error.message}`);

  revalidatePath('/mvs/admin/orgs');
}

export async function demoteOrgAdmin(
  orgId: string,
  studentId: string,
): Promise<void> {
  const { user: caller } = await requireSuperAdmin();
  if (caller.id === studentId) {
    throw new Error('Cannot demote your own role via this UI.');
  }
  const client = adminClient();

  const { data: profile } = await client
    .from('profiles')
    .select('role')
    .eq('id', studentId)
    .single();
  if (profile?.role === 'super_admin') {
    throw new Error('Cannot demote a super_admin via this UI.');
  }
  if (profile?.role !== 'org_admin') {
    throw new Error('Target is not an org_admin.');
  }

  const { error } = await client
    .from('profiles')
    .update({ role: 'student' })
    .eq('id', studentId)
    .eq('org_id', orgId)
    .eq('role', 'org_admin');
  if (error) throw new Error(`Demote failed: ${error.message}`);

  revalidatePath(`/mvs/admin/orgs/${orgId}`);
}

// Reset an enrollment so the student can take it again. Clears both
// completed_at (the gate) and invited_email_sent_at (so the pre-invite
// resender treats it as a fresh outgoing). Idempotent.
export async function resetEnrollment(enrollmentId: string): Promise<void> {
  await requireSuperAdmin();
  const client = adminClient();
  const { error } = await client
    .from('enrollments')
    .update({ completed_at: null, invited_email_sent_at: null })
    .eq('id', enrollmentId);
  if (error) throw new Error(`Reset failed: ${error.message}`);

  // We don't know which orgId hosts this enrollment without a join, so
  // revalidate the orgs subtree broadly.
  revalidatePath('/mvs/admin/orgs');
}
