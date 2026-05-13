'use client';

// Org-detail bottom panel: delete this org. Disabled while any roster
// members remain (the admin must Remove or Delete them first via the
// roster row controls). The server enforces the same rule; this is just
// a UI affordance to make the precondition explicit.
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteOrg, reenableOrg } from '@/actions/orgs';

interface Props {
  orgId: string;
  orgName: string;
  rosterCount: number;
}

export default function DangerZone({ orgId, orgName, rosterCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reenabling, startReenable] = useTransition();
  const disabled = rosterCount > 0;

  const onClick = () => {
    if (disabled) return;
    if (
      !window.confirm(
        `Delete org "${orgName}" permanently? This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteOrg(orgId);
        router.replace('/mvs/admin/orgs');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Delete failed';
        window.alert(msg);
      }
    });
  };

  const onReenable = () => {
    startReenable(async () => {
      try {
        await reenableOrg(orgId);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Re-enable failed';
        window.alert(msg);
      }
    });
  };

  return (
    <section className="bg-white border border-red-200 rounded-xl p-6">
      <h2 className="mvs-mono text-xs font-semibold text-red-700 uppercase tracking-[0.2em] mb-2">
        Danger Zone
      </h2>
      <p className="text-sm text-zinc-600 mb-4">
        {disabled ? (
          <>
            This org still has <strong>{rosterCount}</strong> roster member
            {rosterCount === 1 ? '' : 's'}. Remove or delete everyone in the
            Roster + Org admins tables above before you can delete the org.
          </>
        ) : (
          <>
            The org has no remaining members. Deleting it is permanent and
            cannot be undone.
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || pending}
          className={`mvs-mono text-xs uppercase tracking-widest px-4 py-2 border transition-colors ${
            disabled
              ? 'border-zinc-200 text-zinc-300 cursor-not-allowed'
              : 'border-red-500 text-red-600 hover:bg-red-50'
          }`}
        >
          {pending ? 'Deleting…' : 'Delete this org'}
        </button>
        <button
          type="button"
          onClick={onReenable}
          disabled={reenabling}
          className="mvs-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          title="Force this org's status back to 'active'."
        >
          {reenabling ? 'Re-enabling…' : 'Re-enable this org'}
        </button>
      </div>
    </section>
  );
}
