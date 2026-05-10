'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Marketing-form lead capture + status management.
// `submitLead` is intentionally NOT auth-gated — anonymous visitors fill
// the contact form. RLS on the leads table allows insert for everyone but
// blocks select/update/delete for non-super_admins.

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const ORG_TYPES = ['hospital', 'police', 'defense', 'other'] as const;
const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'dropped'] as const;

type OrgType = (typeof ORG_TYPES)[number];
type LeadStatus = (typeof STATUSES)[number];

export type SubmitLeadResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function submitLead(
  _prev: SubmitLeadResult | null,
  formData: FormData
): Promise<SubmitLeadResult> {
  // Honeypot: real users never see the field, bots fill everything.
  // Silently succeed (return ok) so the bot thinks it worked and moves on,
  // but skip the DB insert.
  const honeypot = String(formData.get('company_homepage') ?? '').trim();
  if (honeypot) {
    return { status: 'ok' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const organization = String(formData.get('organization') ?? '').trim();
  const orgTypeRaw = String(formData.get('organization_type') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!name || name.length > 200) {
    return { status: 'error', message: 'Name is required.' };
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return { status: 'error', message: 'Please enter a valid email.' };
  }
  if (organization.length > 200) {
    return { status: 'error', message: 'Organization name is too long.' };
  }
  const orgType: OrgType | null =
    orgTypeRaw && (ORG_TYPES as readonly string[]).includes(orgTypeRaw)
      ? (orgTypeRaw as OrgType)
      : null;
  if (message.length > 4000) {
    return { status: 'error', message: 'Message is too long (4000 char max).' };
  }

  const admin = adminClient();
  const { error } = await admin.from('leads').insert({
    name,
    email,
    organization: organization || null,
    organization_type: orgType,
    message: message || null,
  });
  if (error) {
    return { status: 'error', message: 'Submission failed. Please try again.' };
  }

  revalidatePath('/mvs/admin/leads');
  return { status: 'ok' };
}

export async function updateLeadStatus(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id) throw new Error('id required');
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new Error('invalid status');
  }
  const admin = adminClient();
  const { error } = await admin
    .from('leads')
    .update({ status: status as LeadStatus })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/mvs/admin/leads');
}
