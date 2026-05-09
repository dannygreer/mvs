import { describe, it, expect } from 'vitest';
import { decideInviteAction } from '@/lib/invites';

describe('decideInviteAction', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';

  it('returns invite_new when there is no existing profile', () => {
    expect(decideInviteAction(null, orgA)).toEqual({ kind: 'invite_new' });
  });

  it('returns add_existing_to_org when user has no org', () => {
    expect(decideInviteAction({ org_id: null }, orgA)).toEqual({
      kind: 'add_existing_to_org',
    });
  });

  it('returns already_in_this_org when user is already in the target org', () => {
    expect(decideInviteAction({ org_id: orgA }, orgA)).toEqual({
      kind: 'already_in_this_org',
    });
  });

  it('returns conflict_other_org and surfaces the current org id', () => {
    expect(decideInviteAction({ org_id: orgB }, orgA)).toEqual({
      kind: 'conflict_other_org',
      currentOrgId: orgB,
    });
  });
});
