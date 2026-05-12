'use client';

// Combined CSV export control. Replaces the two side-by-side CSV (Wide)
// and CSV (Long) buttons on /mvs/admin with a single Export dropdown.
// Same backend route (/api/admin/export-csv?format=wide|long) — the
// dropdown just picks which format to fire.
import { useEffect, useRef, useState } from 'react';

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside-click + Escape, same pattern as a standard menu.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const linkClass =
    'block w-full text-left px-4 py-2 mvs-mono text-[11px] uppercase tracking-[0.18em] text-zinc-700 hover:bg-zinc-50';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="mvs-mono px-4 py-2 bg-zinc-900 text-white text-[11px] uppercase tracking-[0.18em] hover:bg-zinc-800 transition-colors inline-flex items-center gap-2"
      >
        Export
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 shadow-md z-20"
        >
          <a
            href="/api/admin/export-csv?format=wide"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            CSV (Wide)
          </a>
          <a
            href="/api/admin/export-csv?format=long"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            CSV (Long)
          </a>
        </div>
      )}
    </div>
  );
}
