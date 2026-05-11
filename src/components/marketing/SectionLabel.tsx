// Framed section label — flanking dashes on either side of an uppercase
// label. Replaces the previous plain `text-xs uppercase tracking-widest`.
// Usage: <SectionLabel>What it is</SectionLabel>
export default function SectionLabel({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  const justify = align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <div className={`flex items-center gap-3 ${justify}`}>
      <span className="h-px w-6 bg-[#016FD4]/60" />
      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-[#4FA9F0]">
        {children}
      </span>
      <span className="h-px w-6 bg-[#016FD4]/60" />
    </div>
  );
}
