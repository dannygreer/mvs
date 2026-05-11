import RadarBackdrop from '@/components/marketing/RadarBackdrop';
import MissionPanel from '@/components/marketing/MissionPanel';
import PerformanceSnapshot from '@/components/marketing/PerformanceSnapshot';
import ContactForm from '@/components/marketing/ContactForm';
import SiteHeader from '@/components/marketing/SiteHeader';
import SectionLabel from '@/components/marketing/SectionLabel';
import SiteFooter from '@/components/marketing/SiteFooter';
import HudButton from '@/components/marketing/HudButton';

export const metadata = {
  title: 'MVS — Mental Velocity System',
  description:
    'A behavioral measurement system for the moments when timing, sequencing, and recovery decide outcomes.',
};

export default function MarketingHome() {
  return (
    <div className="bg-zinc-950 text-zinc-100 selection:bg-[#016FD4]/40 mvs-body">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)]"
          aria-hidden="true"
        />
        <RadarBackdrop />

        <SiteHeader />

        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full px-6 sm:px-10 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center">
            {/* LEFT — headline + copy + CTA */}
            <div className="space-y-8">
              <h1 className="mvs-display text-[3.5rem] sm:text-[5rem] md:text-[7rem] font-bold leading-[0.95] tracking-wide bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                MEASURE.
                <br />
                UNDERSTAND.
                <br />
                GOVERN.
              </h1>
              <p className="text-xl sm:text-2xl text-[#4FA9F0] tracking-wide">
                Governing decisions under pressure.
              </p>
              <div className="space-y-4 text-lg text-zinc-300 max-w-xl leading-relaxed">
                <p>
                  The Mental Velocity System™ equips professionals to recognize,
                  control, and optimize decision-making when it matters most.
                </p>
                <p>
                  Run scenario-based analytics, review your performance data,
                  track progress, and maintain your certification.
                </p>
              </div>
              <div>
                <HudButton href="/contact" size="lg">
                  Request a briefing
                </HudButton>
              </div>
            </div>

            {/* RIGHT — Your Mission panel over the radar backdrop */}
            <div className="lg:pl-4 lg:max-w-md lg:ml-auto w-full">
              <MissionPanel />
            </div>
          </div>
        </div>

        <p className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 pb-8 italic uppercase tracking-widest text-xs text-zinc-400">
          Built for those who decide when others can&apos;t.
        </p>
      </section>

      {/* What it is + Performance snapshot */}
      <section className="py-24 sm:py-32 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto w-full px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-start">
          <div className="space-y-6">
            <SectionLabel>What is MVS</SectionLabel>
            <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
              This is not a drill.
            </h2>
            <div className="space-y-5 text-zinc-300 leading-relaxed text-lg max-w-xl">
              <p>
                Most training measures whether you remember the right answer.
                The Mental Velocity System measures something else: how quickly
                your decision forms, what you stop noticing, and whether
                sequence breaks down under load.
              </p>
              <p>
                It&apos;s a pre/post measurement wrapped around an in-person
                training day. Every selection is captured as its own data
                point — reaction time, sequence, branching, recovery. The
                result is a behavioral map of how decisions actually form when
                pressure is real.
              </p>
              <p>
                Used by clinicians, law enforcement, and operational teams
                whose decisions cannot afford a second draft.
              </p>
            </div>
          </div>
          <div className="lg:mt-2">
            <div style={{ width: '498.37px', maxWidth: '100%' }}>
              <PerformanceSnapshot showDonut={false} />
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* The doctor */}
      <section className="hidden py-24 sm:py-32 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto w-full px-6 sm:px-10">
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-12 items-start">
            <div className="aspect-[4/5] w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 text-sm">
              Photo
              <span className="sr-only">[NEEDS_DOCTOR — headshot]</span>
            </div>
            <div className="space-y-6">
            <SectionLabel>The doctor</SectionLabel>
            <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
              Dr. Kevin Scully
            </h2>
            <div className="space-y-4 text-zinc-300 leading-relaxed">
              <p>
                Founder of Human Performance Risk Control Infrastructure™.
                Dr. Scully designed the Mental Velocity System after [
                <span className="text-amber-400 mvs-mono text-sm">
                  NEEDS_DOCTOR — career background, credentials, why this
                  matters to him
                </span>
                ].
              </p>
              <p>
                The system is the result of [
                <span className="text-amber-400 mvs-mono text-sm">
                  NEEDS_DOCTOR — years of clinical/operational work
                </span>
                ].
              </p>
            </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
