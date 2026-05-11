import Image from 'next/image';
import Link from 'next/link';

const NAV: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Certification', href: '/certification' },
  { label: 'Decision Analytics', href: '/decision-analytics' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

// Top navigation for the public marketing site. Same dark aesthetic as
// the rest of the marketing surface. Reused across /, /certification,
// /decision-analytics, /contact.
export default function SiteHeader() {
  return (
    <header className="relative z-20 max-w-7xl mx-auto w-full px-6 sm:px-10 py-5 flex items-center justify-between">
      <Link href="/" className="flex items-center group">
        <Image
          src="/mvs-logo.png"
          alt="MVS — Mental Velocity System"
          width={329}
          height={32}
          priority
          className="h-8 w-auto group-hover:opacity-90 transition-opacity"
        />
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-xs uppercase tracking-widest text-zinc-400 hover:text-[#4FA9F0] transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/auth/login"
        className="mvs-mono inline-flex items-center gap-2 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#4FA9F0] hover:text-white hover:bg-[#016FD4] transition-colors"
        style={{ border: '1px solid rgba(1,111,212,0.55)' }}
      >
        Sign in
        <span aria-hidden="true">›</span>
      </Link>
    </header>
  );
}
