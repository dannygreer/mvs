// Pure decision logic extracted from src/actions/orgs.ts inviteStudents
// so the conflict / add / already-in / new branches can be unit-tested
// without invoking the Supabase admin SDK (which is rate-limited and sends
// real email).

export type ExistingProfile = { org_id: string | null } | null;

export type InviteDecision =
  | { kind: 'invite_new' }
  | { kind: 'add_existing_to_org' }
  | { kind: 'already_in_this_org' }
  | { kind: 'conflict_other_org'; currentOrgId: string };

export function decideInviteAction(
  existing: ExistingProfile,
  targetOrgId: string
): InviteDecision {
  if (!existing) return { kind: 'invite_new' };
  if (!existing.org_id) return { kind: 'add_existing_to_org' };
  if (existing.org_id === targetOrgId) return { kind: 'already_in_this_org' };
  return { kind: 'conflict_other_org', currentOrgId: existing.org_id };
}
