'use client';

// Dismissable floating notice for the admin student-landing preview.
// Fixed bottom-right so it doesn't eat layout space; collapses to
// nothing once dismissed (state is per page-load, intentionally not
// persisted — re-showing on each visit is the safer default for a
// "this is a preview" warning).
import { useState } from 'react';

export default function PreviewFloatingNotice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-amber-50 border border-amber-200 rounded-xl shadow-lg p-4">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-amber-700 hover:text-amber-900 text-sm leading-none"
      >
        ✕
      </button>
      <p className="mvs-mono text-[11px] uppercase tracking-widest text-amber-800 pr-5">
        Admin preview — student session-day landing
      </p>
      <p className="text-sm text-amber-900 mt-1">
        This is exactly what a student sees after logging in, with all
        phases shown active. The Start buttons open the existing admin
        preview runs in a new tab — no responses are recorded. A real
        student sees Phase 2 / 3 locked until the prior phase is complete.
      </p>
    </div>
  );
}
