'use client';

import { useActionState, useEffect, useRef } from 'react';
import { inviteOrgAdmin, type InviteOrgAdminResult } from '@/actions/orgs';

interface Props {
  orgId: string;
}

const STATUS_STYLE: Record<string, string> = {
  invited: 'bg-emerald-50 text-emerald-700',
  promoted_student: 'bg-amber-50 text-amber-700',
  already_admin: 'bg-zinc-100 text-zinc-600',
  conflict_other_org: 'bg-amber-50 text-amber-700',
  super_admin_protected: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
};

export default function InviteOrgAdminForm({ orgId }: Props) {
  const [state, action, pending] = useActionState<
    InviteOrgAdminResult | null,
    FormData
  >(inviteOrgAdmin, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear inputs after a clean invite.
  useEffect(() => {
    if (state?.status === 'invited') formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          name="fullName"
          type="text"
          required
          placeholder="Full name"
          disabled={pending}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="email@example.com"
          disabled={pending}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:bg-zinc-300"
        >
          {pending ? 'Inviting…' : 'Invite admin'}
        </button>
        {state?.message && (
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              STATUS_STYLE[state.status] ?? 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
