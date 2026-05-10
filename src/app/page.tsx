import Image from 'next/image';
import Link from 'next/link';
import RadarBackdrop from '@/components/marketing/RadarBackdrop';
import ContactForm from '@/components/marketing/ContactForm';

export const metadata = {
  title: 'MVS — Mental Velocity System',
  description:
    'A behavioral measurement system for the moments when timing, sequencing, and recovery decide outcomes.',
};

export default function MarketingHome() {
  return (
    <div className="bg-zinc-950 text-zinc-100 selection:bg-cyan-400/30">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)]"
          aria-hidden="true"
        />
        <RadarBackdrop />

        <header className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/mvs-icon.png"
              alt="MVS"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="text-sm font-medium tracking-wider text-zinc-300">
              MVS
            </span>
          </div>
          <Link
            href="/auth/login"
            className="text-sm text-zinc-400 hover:text-cyan-300 transition-colors"
          >
            Sign in
          </Link>
        </header>

        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full px-6 sm:px-10 py-12">
          <div className="max-w-3xl space-y-8">
            <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold leading-[0.95] tracking-tight bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
              MEASURE.
              <br />
              UNDERSTAND.
              <br />
              GOVERN.
            </h1>
            <p className="text-xl sm:text-2xl text-cyan-300 tracking-wide">
              Governing decisions under pressure.
            </p>
            <p className="text-lg text-zinc-300 max-w-xl leading-relaxed">
              A behavioral measurement system for the moments when timing,
              sequencing, and recovery decide outcomes.
            </p>
            <div>
              <a
                href="#contact"
                className="inline-block text-lg px-8 py-3 border border-cyan-400 text-cyan-300 rounded-lg hover:bg-cyan-400 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors font-medium"
              >
                Request a briefing
              </a>
            </div>
          </div>
        </div>

        <p className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 pb-8 italic uppercase tracking-widest text-xs text-zinc-400">
          Built for those who decide when others can&apos;t.
        </p>
      </section>

      {/* What it is */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-medium">
            What it is
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100">
            This is not a quiz.
          </h2>
          <div className="space-y-5 text-zinc-300 leading-relaxed text-lg">
            <p>
              Most training measures whether you remember the right answer. The
              Mental Velocity System measures something else: how quickly your
              decision forms, what you stop noticing, and whether sequence
              breaks down under load.
            </p>
            <p>
              It&apos;s a pre/post measurement wrapped around an in-person
              training day. Every selection is captured as its own data
              point — reaction time, sequence, branching, recovery. The result
              is a behavioral map of how decisions actually form when pressure
              is real.
            </p>
            <p>
              Used by clinicians, law enforcement, and operational teams whose
              decisions cannot afford a second draft.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-24 sm:py-32 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs uppercase tracking-widest text-cyan-400 font-medium">
              Who it&apos;s for
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100">
              Three contexts. One system.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                label: 'Hospitals',
                line: 'Clinicians making time-critical decisions with incomplete information.',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 stroke-cyan-400" strokeWidth="1.5">
                    <path d="M12 4v16M4 12h16" strokeLinecap="round" />
                    <rect x="4" y="4" width="16" height="16" rx="1.5" />
                  </svg>
                ),
              },
              {
                label: 'Law Enforcement',
                line: 'Officers operating in environments where timing dictates outcome.',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 stroke-cyan-400" strokeWidth="1.5">
                    <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                label: 'Defense',
                line: 'Operational teams whose mission depends on coordinated decision velocity.',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 stroke-cyan-400" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                ),
              },
            ].map((c) => (
              <div
                key={c.label}
                className="border border-zinc-800 rounded-xl p-6 space-y-4 bg-zinc-900/30"
              >
                {c.icon}
                <p className="text-sm uppercase tracking-wider text-zinc-100 font-medium">
                  {c.label}
                </p>
                <p className="text-zinc-400 leading-relaxed">{c.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The doctor */}
      <section className="py-24 sm:py-32 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[320px_1fr] gap-12 items-start">
          <div className="aspect-[4/5] w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 text-sm">
            Photo
            <span className="sr-only">[NEEDS_DOCTOR — headshot]</span>
          </div>
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-widest text-cyan-400 font-medium">
              The doctor
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100">
              Dr. Kevin Scully
            </h2>
            <div className="space-y-4 text-zinc-300 leading-relaxed">
              <p>
                Founder of Human Performance Risk Control Infrastructure™.
                Dr. Scully designed the Mental Velocity System after [
                <span className="text-amber-400 font-mono text-sm">
                  NEEDS_DOCTOR — career background, credentials, why this
                  matters to him
                </span>
                ].
              </p>
              <p>
                The system is the result of [
                <span className="text-amber-400 font-mono text-sm">
                  NEEDS_DOCTOR — years of clinical/operational work
                </span>
                ].
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="py-24 sm:py-32 px-6 border-t border-zinc-900"
      >
        <div className="max-w-lg mx-auto space-y-8">
          <div className="text-center space-y-4">
            <p className="text-xs uppercase tracking-widest text-cyan-400 font-medium">
              Get in touch
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100">
              Request a briefing.
            </h2>
            <p className="text-zinc-400">
              Tell us who you are and we&apos;ll set up a 30-minute conversation.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 px-6 text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Mental Velocity System</p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>secure</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
