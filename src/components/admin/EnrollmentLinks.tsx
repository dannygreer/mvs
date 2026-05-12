'use client';

import { useState, useTransition } from 'react';
import { resetEnrollment } from '@/actions/orgs';

interface Link {
  id: string;
  phase: 'pre' | 'post' | 'practice';
  url: string;
  completed_at: string | null;
}

interface EnrollmentLinksProps {
  links: Link[];
}

export default function EnrollmentLinks({ links }: EnrollmentLinksProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (links.length === 0) {
    return <span className="text-zinc-400 text-xs">—</span>;
  }

  function copy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  }

  function onReset(id: string, phase: string) {
    if (
      !window.confirm(
        `Reset the ${phase}-assessment for this student? Their previous responses stay in the data, but the link becomes usable again so they can take it.`,
      )
    ) {
      return;
    }
    setResetting(id);
    startTransition(async () => {
      try {
        await resetEnrollment(id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Reset failed';
        window.alert(msg);
      } finally {
        setResetting((r) => (r === id ? null : r));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {links.map((l) => (
        <span key={l.id} className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => copy(l.url, l.id)}
            disabled={!!l.completed_at}
            title={l.completed_at ? `Completed ${new Date(l.completed_at).toLocaleDateString()}` : l.url}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
              l.completed_at
                ? 'border-zinc-200 text-zinc-400 line-through'
                : copied === l.id
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {l.phase}
            {!l.completed_at && (
              <span className="text-zinc-400">
                {copied === l.id ? '✓' : '⧉'}
              </span>
            )}
          </button>
          {l.completed_at && (
            <button
              type="button"
              onClick={() => onReset(l.id, l.phase)}
              disabled={resetting === l.id}
              title="Reset so the student can retake"
              className="mvs-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:text-zinc-700 disabled:opacity-60"
            >
              {resetting === l.id ? '…' : 'reset'}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
