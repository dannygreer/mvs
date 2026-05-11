import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

// Shared shell for marketing sub-pages (certification, decision analytics,
// contact). Same dark aesthetic + nav as `/`. The hero is a tight, headline-
// only band; pages compose their own sections below.
export default function PageShell({
  eyebrow,
  title,
  intro,
  headerImage,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  headerImage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-950 text-zinc-100 selection:bg-[#016FD4]/40 min-h-screen flex flex-col mvs-body">
      <div className="relative">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,#0e1422_0%,#050810_60%,#000_100%)] pointer-events-none"
          aria-hidden="true"
        />
        {headerImage && (
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 right-0 pointer-events-none"
            style={{
              left: '30%',
              backgroundImage: `url(${headerImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'right center',
              backgroundRepeat: 'no-repeat',
              maskImage:
                'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 25%, rgba(0,0,0,0.45) 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 25%, rgba(0,0,0,0.45) 100%)',
            }}
          />
        )}
        <div className="relative z-10">
          <SiteHeader />
          <header className="max-w-7xl mx-auto w-full px-6 sm:px-10 pt-12 pb-16 sm:pt-20 sm:pb-24">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#4FA9F0] mb-4">
              {eyebrow}
            </p>
            <h1 className="mvs-display text-5xl sm:text-7xl font-bold uppercase leading-tight tracking-wide bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent max-w-3xl">
              {title}
            </h1>
            {intro && (
              <p className="text-lg sm:text-xl text-zinc-300 mt-6 max-w-2xl leading-relaxed">
                {intro}
              </p>
            )}
          </header>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}
