'use client';

// Per-row delete button on the org list. Disabled when the org has any
// roster members — clicking the disabled state shows a tooltip explaining
// the empty-first rule. Confirms via window.confirm before firing the
// server action (consistent with the rest of admin per the plan).
import { useTransition } from 'react';
import { deleteOrg } from '@/actions/orgs';

interface Props {
  orgId: string;
  orgName: string;
  studentCount: number;
}

export default function OrgListDeleteButton({
  orgId,
  orgName,
  studentCount,
}: Props) {
  const [pending, startTransition] = useTransition();
  const disabled = studentCount > 0;

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
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Delete failed';
        window.alert(msg);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={
        disabled
          ? 'Remove all students first.'
          : 'Delete this org permanently.'
      }
      className={`mvs-mono text-[10px] uppercase tracking-widest transition-colors ${
        disabled
          ? 'text-zinc-300 cursor-not-allowed'
          : 'text-red-500 hover:text-red-700'
      }`}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
