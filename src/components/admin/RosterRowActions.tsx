'use client';

// Per-row corrective controls on the org detail roster + org_admins tables.
// Renders inline mvs-mono links; each opens a window.confirm dialog and
// fires a server action. Disabled when the row IS the calling super_admin
// (self-protection mirrored from the server side).
import { useTransition } from 'react';
import {
  removeStudentFromOrg,
  deleteStudent,
  demoteOrgAdmin,
} from '@/actions/orgs';

interface Props {
  orgId: string;
  profileId: string;
  fullName: string | null;
  email: string | null;
  role: 'student' | 'org_admin' | 'super_admin';
  isSelf: boolean;
}

export default function RosterRowActions({
  orgId,
  profileId,
  fullName,
  email,
  role,
  isSelf,
}: Props) {
  const [pending, startTransition] = useTransition();
  const label = fullName || email || 'this user';

  // Super-admins on the roster are display-only — no destructive UI for
  // them. Demoting / deleting a super_admin is a SQL operation.
  if (role === 'super_admin') {
    return (
      <span className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-400">
        super_admin
      </span>
    );
  }

  if (isSelf) {
    return (
      <span className="mvs-mono text-[10px] uppercase tracking-widest text-zinc-400">
        you
      </span>
    );
  }

  const fire = (
    confirmMessage: string,
    action: () => Promise<void>,
  ) => {
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Action failed';
        window.alert(msg);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-3 mvs-mono text-[10px] uppercase tracking-widest">
      {role === 'org_admin' && (
        <button
          type="button"
          onClick={() =>
            fire(
              `Demote "${label}" from org_admin to student? They will lose their /org dashboard access.`,
              () => demoteOrgAdmin(orgId, profileId),
            )
          }
          disabled={pending}
          className="text-amber-600 hover:text-amber-800 disabled:opacity-60"
        >
          Demote
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          fire(
            `Remove "${label}" from this org? Their account remains but they will no longer be a member of this org.`,
            () => removeStudentFromOrg(orgId, profileId),
          )
        }
        disabled={pending}
        className="text-zinc-500 hover:text-zinc-800 disabled:opacity-60"
      >
        Remove
      </button>
      <button
        type="button"
        onClick={() =>
          fire(
            `Delete account for "${label}"? This permanently removes their auth user, profile, and any enrollments. Their response data stays in the database but their student_id becomes NULL (anonymized).`,
            () => deleteStudent(profileId),
          )
        }
        disabled={pending}
        className="text-red-500 hover:text-red-700 disabled:opacity-60"
      >
        Delete
      </button>
    </div>
  );
}
