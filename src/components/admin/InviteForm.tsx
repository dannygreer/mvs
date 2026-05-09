'use client';

import { useActionState } from 'react';
import { inviteStudents, type InviteResult } from '@/actions/orgs';

interface InviteFormProps {
  orgId: string;
}

const STATUS_LABEL: Record<string, string> = {
  invited: 'Invited',
  already_exists_added_to_org: 'Existing user — added to this org',
  already_in_this_org: 'Already in this org',
  conflict_other_org: 'Conflict',
  parse_error: 'Parse error',
  error: 'Error',
};

const STATUS_STYLE: Record<string, string> = {
  invited: 'text-emerald-700 bg-emerald-50',
  already_exists_added_to_org: 'text-blue-700 bg-blue-50',
  already_in_this_org: 'text-zinc-600 bg-zinc-100',
  conflict_other_org: 'text-amber-700 bg-amber-50',
  parse_error: 'text-red-700 bg-red-50',
  error: 'text-red-700 bg-red-50',
};

export default function InviteForm({ orgId }: InviteFormProps) {
  const [state, formAction, pending] = useActionState<InviteResult | null, FormData>(
    inviteStudents,
    null
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="orgId" value={orgId} />
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Roster
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            One per line: <code>FirstName,LastName,email@example.com</code>. Each
            gets a magic-link invite.
          </p>
          <textarea
            name="roster"
            rows={10}
            required
            disabled={pending}
            placeholder={`Jane,Smith,jane@example.com\nJohn,Doe,john@example.com`}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-zinc-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent disabled:bg-zinc-100"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            {pending ? 'Sending invites…' : 'Send invites'}
          </button>
        </div>
      </form>

      {state && (
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center gap-4 text-sm">
            <span className="text-emerald-700 font-medium">
              {state.invitedCount} invited
            </span>
            {state.conflictCount > 0 && (
              <span className="text-amber-700 font-medium">
                {state.conflictCount} conflict
                {state.conflictCount === 1 ? '' : 's'}
              </span>
            )}
            {state.errorCount > 0 && (
              <span className="text-red-700 font-medium">
                {state.errorCount} error{state.errorCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium w-12">Line</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr
                  key={`${r.line}-${r.raw}`}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-4 py-2 text-zinc-500 tabular-nums">
                    {r.line}
                  </td>
                  <td className="px-4 py-2 text-zinc-700">
                    {r.email ?? r.raw}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                        STATUS_STYLE[r.status] ?? 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {r.message ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
