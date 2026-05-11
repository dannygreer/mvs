import PageShell from '@/components/marketing/PageShell';
import SectionFrame from '@/components/marketing/SectionFrame';
import ContactForm from '@/components/marketing/ContactForm';

function ContactInfoCard({
  code,
  label,
  value,
  sub,
  href,
  icon,
}: {
  code: string;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  icon: React.ReactNode;
}) {
  const Inner = (
    <div className="flex items-start gap-4 p-5 sm:p-6">
      <div
        className="shrink-0 w-10 h-10 flex items-center justify-center"
        style={{ border: '1px solid rgba(1,111,212,0.45)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mvs-mono text-[10px] uppercase tracking-[0.25em] text-[#4FA9F0]">
          {label}
        </p>
        <p className="mvs-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-zinc-100 mt-1">
          {value}
        </p>
        {sub && (
          <p className="mvs-mono text-[11px] uppercase tracking-widest text-zinc-400 mt-1">
            {sub}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="relative mvs-mono bg-zinc-950/40"
      style={{ border: '1px solid rgba(1,111,212,0.20)' }}
    >
      {href ? (
        <a
          href={href}
          className="block hover:bg-[#016FD4]/10 transition-colors"
        >
          {Inner}
        </a>
      ) : (
        Inner
      )}
    </div>
  );
}

export const metadata = {
  title: 'Contact — MVS',
  description:
    'Schedule a briefing on the Mental Velocity System for your organization.',
};

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Request a briefing."
      intro="Tell us how we can help and we'll set up a conversation."
    >
      <SectionFrame code="SECT.01 / INTAKE">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
          <div>
            <ContactForm />
          </div>
          <div className="space-y-6 sm:space-y-8">
            <ContactInfoCard
              code="C.01 / DIRECT LINE"
              label="Phone"
              value="555-555-5555"
              href="tel:5555555555"
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-[#4FA9F0]" strokeWidth="1.6">
                  <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 4 7a3 3 0 0 1 1-3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <ContactInfoCard
              code="C.02 / OPS RANGE"
              label="Location"
              value="Based in Texas"
              sub="Available worldwide"
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-[#4FA9F0]" strokeWidth="1.6">
                  <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              }
            />
          </div>
        </div>
      </SectionFrame>
    </PageShell>
  );
}
