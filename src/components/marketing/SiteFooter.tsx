// Marketing footer with HUD-style status chrome.
export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-900 py-6 px-6 text-xs text-zinc-400 mvs-mono">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-zinc-500">
            © {new Date().getFullYear()} Mental Velocity System
          </span>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <span className="hidden sm:inline text-zinc-500 uppercase tracking-widest">
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-widest">
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SYS.OK
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">SECURE</span>
        </div>
      </div>
    </footer>
  );
}
