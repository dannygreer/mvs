// Shared admin chrome (top header + secondary tab nav). Used by every
// /mvs/admin/* page so the brand bar, action buttons, and tab indicators
// stay consistent. Server-rendered; passes `activeRoute` so the active
// tab gets the underline treatment.

import Link from 'next/link';
import ExportMenu from './ExportMenu';
import { signOut } from '@/actions/session';

interface NavItem {
  label: string;
  href: string;
  // Matches when the current pathname starts with this prefix.
  matchPrefix: string;
}

const TABS: NavItem[] = [
  { label: 'Dashboard', href: '/mvs/admin', matchPrefix: '/mvs/admin' },
  // Responses + Summary tabs hidden for now (routes still live). Phase
  // pages have their own per-phase Responses sub-tab, so the global
  // Responses/Summary views are redundant for v1. Revisit later — see
  // memory note "admin_hidden_tabs".
  // { label: 'Responses', href: '/mvs/admin/responses', matchPrefix: '/mvs/admin/responses' },
  { label: 'Phase 1', href: '/mvs/admin/phase-1', matchPrefix: '/mvs/admin/phase-1' },
  { label: 'Phase 2', href: '/mvs/admin/phase-2', matchPrefix: '/mvs/admin/phase-2' },
  { label: 'Phase 3', href: '/mvs/admin/phase-3', matchPrefix: '/mvs/admin/phase-3' },
  // { label: 'Summary', href: '/mvs/admin/summary', matchPrefix: '/mvs/admin/summary' },
  { label: 'Orgs', href: '/mvs/admin/orgs', matchPrefix: '/mvs/admin/orgs' },
  { label: 'Leads', href: '/mvs/admin/leads', matchPrefix: '/mvs/admin/leads' },
];

function isActive(activeRoute: string, item: NavItem): boolean {
  // Dashboard is the special case — it owns the exact /mvs/admin path
  // (everything else lives under a subpath). Without this, /Dashboard
  // would highlight on every admin route.
  if (item.matchPrefix === '/mvs/admin') {
    return activeRoute === '/mvs/admin';
  }
  return activeRoute.startsWith(item.matchPrefix);
}

interface Props {
  // Page title shown in the H1 slot. Defaults to "MVS — Admin".
  title?: string;
  subtitle?: string;
  // Current pathname so the active tab can render the underline.
  activeRoute: string;
}

export default function AdminHeader({
  title = 'MENTAL VELOCITY SYSTEM - ADMIN',
  subtitle,
  activeRoute,
}: Props) {
  return (
    <header className="bg-white border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="mvs-display text-2xl font-bold uppercase tracking-wide text-zinc-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 mvs-mono text-[11px] uppercase tracking-[0.18em]">
          <ExportMenu />
          <form action={signOut}>
            <button
              type="submit"
              className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              LOGOUT
            </button>
          </form>
        </div>
      </div>

      <nav className="max-w-7xl mx-auto px-6 flex items-stretch border-t border-zinc-100 overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => {
          const active = isActive(activeRoute, t);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`mvs-mono px-4 py-3 text-[11px] uppercase tracking-[0.22em] whitespace-nowrap transition-colors ${
                active
                  ? 'text-zinc-900 border-b-2 border-zinc-900 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <a
          href="/mvs/admin/preview/student-landing"
          target="_blank"
          rel="noopener noreferrer"
          className="mvs-mono ml-auto self-center px-4 py-3 text-[11px] uppercase tracking-[0.22em] whitespace-nowrap text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          Preview student landing ↗
        </a>
      </nav>
    </header>
  );
}
