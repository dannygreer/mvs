'use client';

// Sticky strip rendered atop the scenario / MC runner when an admin is
// running through an assessment in preview mode. Two purposes:
//   - prevent the admin from confusing a preview pass with a live student
//     submission (the runner UI is intentionally identical)
//   - give them a one-click escape back to /mvs/admin
//
// Only rendered when `previewMode = true`. Both Quiz.tsx and McQuiz.tsx
// mount this conditionally at the top of their JSX.

import Link from 'next/link';

interface Props {
  backHref?: string;
}

export default function PreviewBanner({
  backHref = '/mvs/admin',
}: Props) {
  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-amber-500/95 text-zinc-950 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between mvs-mono text-[10px] uppercase tracking-[0.22em]">
        <span className="font-semibold">
          Preview Mode — no data is being recorded
        </span>
        <Link
          href={backHref}
          className="text-zinc-950/80 hover:text-zinc-950 underline-offset-2 hover:underline"
        >
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}
