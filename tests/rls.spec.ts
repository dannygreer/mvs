import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_PASSWORD = 'rls-test-Pass-1234!';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type TestUser = { id: string; email: string };

let orgA: string;
let orgB: string;
let superAdmin: TestUser;
let orgAdminA: TestUser;
let orgAdminB: TestUser;
let studentA: TestUser;
let studentB: TestUser;

async function makeUser(
  email: string,
  role: 'super_admin' | 'org_admin' | 'student',
  orgId: string | null
): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user!.id;
  // Trigger created profile w/ default role 'student'. Update to test role/org.
  const { error: upErr } = await admin
    .from('profiles')
    .update({ role, org_id: orgId })
    .eq('id', id);
  if (upErr) throw upErr;
  return { id, email };
}

async function userClient(email: string): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw error;
  return c;
}

beforeAll(async () => {
  const stamp = Date.now();
  const tag = `rls_${stamp}`;

  const { data: oa, error: oaErr } = await admin
    .from('orgs')
    .insert({ name: `${tag}_A` })
    .select('id')
    .single();
  if (oaErr) throw oaErr;
  const { data: ob, error: obErr } = await admin
    .from('orgs')
    .insert({ name: `${tag}_B` })
    .select('id')
    .single();
  if (obErr) throw obErr;
  orgA = oa.id;
  orgB = ob.id;

  superAdmin = await makeUser(`super.${stamp}@rlstest.local`, 'super_admin', null);
  orgAdminA = await makeUser(`oa.a.${stamp}@rlstest.local`, 'org_admin', orgA);
  orgAdminB = await makeUser(`oa.b.${stamp}@rlstest.local`, 'org_admin', orgB);
  studentA = await makeUser(`s.a.${stamp}@rlstest.local`, 'student', orgA);
  studentB = await makeUser(`s.b.${stamp}@rlstest.local`, 'student', orgB);
});

afterAll(async () => {
  for (const u of [superAdmin, orgAdminA, orgAdminB, studentA, studentB]) {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  }
  if (orgA && orgB) {
    await admin.from('orgs').delete().in('id', [orgA, orgB]);
  }
});

describe('RLS — orgs', () => {
  it('super_admin sees both test orgs', async () => {
    const c = await userClient(superAdmin.email);
    const { data } = await c.from('orgs').select('id').in('id', [orgA, orgB]);
    expect(data?.map((r) => r.id).sort()).toEqual([orgA, orgB].sort());
  });

  it('org_admin sees only own org', async () => {
    const c = await userClient(orgAdminA.email);
    const { data } = await c.from('orgs').select('id').in('id', [orgA, orgB]);
    expect(data?.map((r) => r.id)).toEqual([orgA]);
  });

  it('student sees only own org', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c.from('orgs').select('id').in('id', [orgA, orgB]);
    expect(data?.map((r) => r.id)).toEqual([orgA]);
  });
});

describe('RLS — profiles', () => {
  it('org_admin reads only profiles in own org', async () => {
    const c = await userClient(orgAdminA.email);
    const { data } = await c
      .from('profiles')
      .select('id')
      .in('id', [studentA.id, studentB.id, orgAdminB.id]);
    const ids = (data ?? []).map((r) => r.id).sort();
    // Should see studentA (own org) but NOT studentB or orgAdminB.
    expect(ids).toEqual([studentA.id].sort());
  });

  it('student reads own profile', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c
      .from('profiles')
      .select('id, role')
      .eq('id', studentA.id)
      .single();
    expect(data?.id).toBe(studentA.id);
    expect(data?.role).toBe('student');
  });

  it('student cannot read another student profile', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c
      .from('profiles')
      .select('id')
      .eq('id', studentB.id);
    expect(data ?? []).toEqual([]);
  });

  it('student cannot self-promote to super_admin', async () => {
    const c = await userClient(studentA.email);
    await c.from('profiles').update({ role: 'super_admin' }).eq('id', studentA.id);
    const { data: after } = await admin
      .from('profiles')
      .select('role')
      .eq('id', studentA.id)
      .single();
    expect(after?.role).toBe('student');
  });

  it('student cannot move themselves to another org', async () => {
    const c = await userClient(studentA.email);
    await c.from('profiles').update({ org_id: orgB }).eq('id', studentA.id);
    const { data: after } = await admin
      .from('profiles')
      .select('org_id')
      .eq('id', studentA.id)
      .single();
    expect(after?.org_id).toBe(orgA);
  });
});

describe('RLS — content (scenarios/screens/options)', () => {
  it('anonymous client cannot read scenarios', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await anon.from('scenarios').select('id');
    expect(data ?? []).toEqual([]);
  });

  it('authenticated student can read scenarios', async () => {
    const c = await userClient(studentA.email);
    const { data, error } = await c.from('scenarios').select('id');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('super_admin can insert + delete a scenario', async () => {
    const c = await userClient(superAdmin.email);
    const { data, error } = await c
      .from('scenarios')
      .insert({
        scenario_id: `rls_${Date.now()}`,
        version: '1',
        title: 'rls test',
        entry_screen_id: 'S1',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data) await admin.from('scenarios').delete().eq('id', data.id);
  });

  it('org_admin cannot insert a scenario', async () => {
    const c = await userClient(orgAdminA.email);
    const { error } = await c.from('scenarios').insert({
      scenario_id: `rls_should_fail_${Date.now()}`,
      version: '1',
      title: 'denied',
      entry_screen_id: 'S1',
    });
    expect(error).not.toBeNull();
  });
});

describe('RLS — responses', () => {
  it('student cannot read responses_long', async () => {
    const c = await userClient(studentA.email);
    const { data } = await c.from('responses_long').select('id').limit(1);
    expect(data ?? []).toEqual([]);
  });

  it('org_admin cannot read responses_long (until 0005 adds org_id link)', async () => {
    const c = await userClient(orgAdminA.email);
    const { data } = await c.from('responses_long').select('id').limit(1);
    expect(data ?? []).toEqual([]);
  });
});
