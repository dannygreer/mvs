'use client';

import { useState } from 'react';

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

  if (links.length === 0) {
    return <span className="text-zinc-400 text-xs">—</span>;
  }

  function copy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  }

  return (
    <div className="flex flex-wrap gap-1">
      {links.map((l) => (
        <button
          key={l.id}
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
      ))}
    </div>
  );
}
