// Inline SVG backdrop for the hero. Concentric cyan circles at low opacity
// give the "radar / scope" vibe without an image dependency. Server-renderable.
export default function RadarBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 800"
      className="absolute right-[-10%] top-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-30 pointer-events-none"
    >
      <defs>
        <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.18" />
          <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="400" cy="400" r="380" fill="url(#radar-glow)" />
      {[80, 160, 240, 320, 380].map((r) => (
        <circle
          key={r}
          cx="400"
          cy="400"
          r={r}
          fill="none"
          stroke="#22d3ee"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
      ))}
      <line
        x1="400"
        y1="20"
        x2="400"
        y2="780"
        stroke="#22d3ee"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
      <line
        x1="20"
        y1="400"
        x2="780"
        y2="400"
        stroke="#22d3ee"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
    </svg>
  );
}
