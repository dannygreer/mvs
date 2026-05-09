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
  return {
    name,
    type: (String(formData.get('type') ?? '').trim() || null),
    contact_name: (String(formData.get('contact_name') ?? '').trim() || null),
    contact_email: (String(formData.get('contact_email') ?? '').trim() || null),
    status: parseStatus(formData.get('status')),
    deal_value_cents: parseDealValue(formData.get('deal_value')),
    notes: (String(formData.get('notes') ?? '').trim() || null),
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
