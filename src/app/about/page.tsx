import Image from 'next/image';
import PageShell from '@/components/marketing/PageShell';
import SectionFrame from '@/components/marketing/SectionFrame';
import SectionLabel from '@/components/marketing/SectionLabel';
import HudButton from '@/components/marketing/HudButton';

export const metadata = {
  title: 'About — MVS',
  description:
    'Mission, leadership, and the operators behind MVS. Decades of frontline experience in military, medicine, and high-consequence administration.',
};

const LEADERS = [
  {
    code: 'L.01 / 02',
    name: 'Kevin Scully',
    title: 'Expert Consultant & Human Performance Strategist',
    image: '/marketing/scully-v2.jpg',
    bio: [
      'Kevin Scully brings more than 30 years of frontline experience in military, medicine, leadership, and law enforcement to the firm’s tactical advisory. A retired Lieutenant Colonel in the U.S. Air Force and a Master Peace Officer, Kevin has operated at the highest levels of trauma care and special operations.',
      'Having served as a Command Medical Officer for Coalition Special Forces and a SWAT Medical Officer for federal task forces, Kevin possesses a rare ability to translate intricate medical data into the language of “Objective Reasonableness.” His expertise is sought after by legal teams, law enforcement agencies, and sports teams nationwide for leadership analysis and medical-legal consulting, providing the impartial, evidence-based clarity.',
    ],
  },
  {
    code: 'L.02 / 02',
    name: 'Kari Kietzer',
    title: 'Head of Operations & Strategic Liaison',
    image: '/marketing/kari-v2.jpg',
    bio: [
      'Kari Kietzer is the architectural force behind our firm’s operational methodology. With a career spanning over 25 years across the non-profit, for-profit, and international sectors, Kari specializes in transforming complex organizational challenges into streamlined, high-performance systems.',
      'From managing the fiscal and administrative demands of luxury assets in the French Riviera to developing anti-corruption curricula for NATO-aligned experts in Afghanistan, Portugal, Belgium, and Germany, Kari’s pedigree is rooted in high-consequence administration. She serves as a vital bridge between high-level strategy and ground-level execution, ensuring that every project—from the learning management systems to corporate scaling—is built on a foundation of financial discipline and operational integrity.',
    ],
  },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="Frontline experience, made measurable."
      headerImage="/marketing/wireframe-mountains-3.png"
    >
      <SectionFrame code="SECT.01 / MISSION">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
          <div className="space-y-6">
            <SectionLabel>Mission</SectionLabel>
            <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
              Why we exist.
            </h2>
          </div>
          <div className="relative mvs-mono">
            <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#4FA9F0]" />
            <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#4FA9F0]" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#4FA9F0]" />
            <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#4FA9F0]" />
            <div
              className="relative bg-zinc-950/65 backdrop-blur-md p-6 sm:p-8"
              style={{
                border: '1px solid rgba(1,111,212,0.45)',
                boxShadow:
                  'inset 0 0 30px rgba(1,111,212,0.06), 0 0 60px rgba(1,111,212,0.10)',
              }}
            >
              <p className="text-zinc-100 text-lg sm:text-xl leading-relaxed mvs-body">
                To empower organizations with the structural rigor and tactical
                insights required to mitigate risk, command influence, and
                achieve sustainable growth.
              </p>
            </div>
          </div>
        </div>
      </SectionFrame>

      <SectionFrame code="SECT.02 / LEADERSHIP">
        <div className="mb-3">
          <SectionLabel>Leadership profiles</SectionLabel>
        </div>
        <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100 mb-12">
          Command + Operations
        </h2>
        <div className="space-y-12 sm:space-y-16">
          {LEADERS.map((person, i) => (
            <div key={person.name} className="relative">
              <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#4FA9F0]" />
              <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#4FA9F0]" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#4FA9F0]" />
              <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#4FA9F0]" />
              <div
                className="relative bg-zinc-950/55 backdrop-blur-sm"
                style={{ border: '1px solid rgba(1,111,212,0.30)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2 mvs-mono"
                  style={{
                    borderBottom: '1px dashed rgba(1,111,212,0.25)',
                    background:
                      'linear-gradient(180deg, rgba(1,111,212,0.10) 0%, rgba(1,111,212,0.02) 100%)',
                  }}
                >
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#4FA9F0]">
                    Profile
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 tabular-nums">
                    {person.code}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 sm:gap-8 p-5 sm:p-6">
                  <div className="relative">
                    <div
                      className="relative overflow-hidden"
                      style={{ border: '1px solid rgba(1,111,212,0.35)' }}
                    >
                      <Image
                        src={person.image}
                        alt={person.name}
                        width={520}
                        height={680}
                        className="w-full h-auto object-cover"
                        style={{
                          filter: 'grayscale(0.25) contrast(1.02)',
                        }}
                      />
                      <span className="absolute top-1 left-1 w-3 h-3 border-t border-l border-[#4FA9F0]" />
                      <span className="absolute top-1 right-1 w-3 h-3 border-t border-r border-[#4FA9F0]" />
                      <span className="absolute bottom-1 right-1 w-3 h-3 border-b border-r border-[#4FA9F0]" />
                      <span className="absolute bottom-1 left-1 w-3 h-3 border-b border-l border-[#4FA9F0]" />
                    </div>
                    <div className="mt-3 mvs-mono text-[10px] uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                      <span>ID.{String(i + 1).padStart(3, '0')}</span>
                      <span>VERIFIED</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="mvs-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-zinc-100">
                        {person.name}
                      </h3>
                      <p className="mvs-mono text-[11px] sm:text-xs uppercase tracking-[0.22em] text-[#4FA9F0] mt-2">
                        {person.title}
                      </p>
                    </div>
                    <div className="space-y-4 text-zinc-300 leading-relaxed">
                      {person.bio.map((para, j) => (
                        <p key={j}>{para}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionFrame>

      <SectionFrame code="SECT.03 / ENGAGE">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <SectionLabel align="center">Work with us</SectionLabel>
          <h2 className="mvs-display text-4xl sm:text-5xl font-bold uppercase tracking-wide text-zinc-100">
            Request a briefing.
          </h2>
          <p className="text-zinc-300 leading-relaxed text-lg">
            Tell us who you are and we&apos;ll set up a conversation.
          </p>
          <div className="flex justify-center">
            <HudButton href="/contact" size="lg">
              Request a briefing
            </HudButton>
          </div>
        </div>
      </SectionFrame>
    </PageShell>
  );
}
