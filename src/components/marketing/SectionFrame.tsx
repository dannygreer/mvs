// Standard section wrapper for marketing sub-pages.
//
// Provides:
//   - consistent vertical rhythm (py-24 sm:py-32)
//   - matching width + padding to the homepage (max-w-7xl mx-auto px-6 sm:px-10)
//   - optional top hairline divider
//
// Use across /certification, /decision-analytics, /contact so every section
// has the same outer rhythm.
//
// `marks` and `code` are accepted but currently no-ops — kept on the prop
// signature so existing call sites don't break.
export default function SectionFrame({
  children,
  divider = true,
  className = '',
}: {
  children: React.ReactNode;
  divider?: boolean;
  marks?: boolean;
  code?: string;
  className?: string;
}) {
  return (
    <section
      className={`relative py-24 sm:py-32 ${
        divider ? 'border-t border-zinc-900' : ''
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto w-full px-6 sm:px-10">
        {children}
      </div>
    </section>
  );
}
