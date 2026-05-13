import Link from 'next/link';

// Pill toggle between a phase page's two views: Editor (the authoring UI)
// and Responses (the per-phase response slice). Pass the canonical phase
// path (e.g. /mvs/admin/phase-1) and the active view; the component
// preserves any extra query params via `extraQuery` so e.g. Phase 3's
// `?assessment=` selection survives a view switch.
interface Props {
  basePath: string;
  active: 'editor' | 'responses';
  responsesCount: number;
  extraQuery?: Record<string, string | undefined>;
  // Override the "Editor" tab label. Phase 3 uses "Editor + Outcomes"
  // since its editor view also surfaces the cert charts.
  editorLabel?: string;
}

export default function PhaseSubNav({
  basePath,
  active,
  responsesCount,
  extraQuery,
  editorLabel = 'Editor',
}: Props) {
  const buildHref = (view: 'editor' | 'responses') => {
    const params = new URLSearchParams();
    params.set('view', view);
    if (extraQuery) {
      for (const [k, v] of Object.entries(extraQuery)) {
        if (v) params.set(k, v);
      }
    }
    return `${basePath}?${params.toString()}`;
  };

  const Tab = ({
    view,
    label,
  }: {
    view: 'editor' | 'responses';
    label: string;
  }) => {
    const isActive = active === view;
    return (
      <Link
        href={buildHref(view)}
        className={`mvs-mono px-3 py-2 text-[10px] uppercase tracking-widest whitespace-nowrap rounded-md transition-colors ${
          isActive
            ? 'bg-zinc-900 text-white'
            : 'text-zinc-600 hover:bg-zinc-100'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex gap-1 bg-white border border-zinc-200 rounded-xl p-1 w-fit">
      <Tab view="editor" label={editorLabel} />
      <Tab view="responses" label={`Responses (${responsesCount})`} />
    </nav>
  );
}
