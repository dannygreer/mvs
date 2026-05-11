// Animated radar beacon for the hero. Concentric rings + radial spokes +
// a scattered "blip field" of small dots + a few brighter lens-flare
// sparkles + a slow rotating sweep wedge + a central pulsing dot. Pure
// SVG + CSS keyframes — no JS, no images.
//
// Brand color: #016FD4 (deep) + #4FA9F0 (bright) for accents.

// Deterministic blip field. Pre-baked positions keep it stable across
// renders — using Math.random would re-shuffle on every paint.
const BLIPS: { cx: number; cy: number; r: number; o: number }[] = [
  { cx: 80, cy: 120, r: 1.4, o: 0.7 },
  { cx: 165, cy: 60, r: 1, o: 0.5 },
  { cx: 240, cy: 200, r: 1.2, o: 0.6 },
  { cx: 320, cy: 90, r: 0.8, o: 0.4 },
  { cx: 410, cy: 150, r: 1.5, o: 0.8 },
  { cx: 500, cy: 70, r: 1, o: 0.55 },
  { cx: 585, cy: 180, r: 1.2, o: 0.65 },
  { cx: 660, cy: 110, r: 0.9, o: 0.45 },
  { cx: 720, cy: 240, r: 1.3, o: 0.7 },
  { cx: 110, cy: 280, r: 0.8, o: 0.4 },
  { cx: 220, cy: 360, r: 1.4, o: 0.75 },
  { cx: 350, cy: 320, r: 0.9, o: 0.45 },
  { cx: 530, cy: 300, r: 1.1, o: 0.6 },
  { cx: 650, cy: 380, r: 0.8, o: 0.4 },
  { cx: 740, cy: 420, r: 1.3, o: 0.7 },
  { cx: 60, cy: 470, r: 1, o: 0.5 },
  { cx: 200, cy: 510, r: 0.9, o: 0.45 },
  { cx: 290, cy: 460, r: 1.5, o: 0.8 },
  { cx: 460, cy: 540, r: 0.9, o: 0.5 },
  { cx: 570, cy: 480, r: 1.1, o: 0.6 },
  { cx: 700, cy: 560, r: 0.8, o: 0.4 },
  { cx: 130, cy: 620, r: 1.2, o: 0.65 },
  { cx: 260, cy: 680, r: 1, o: 0.5 },
  { cx: 380, cy: 640, r: 1.4, o: 0.75 },
  { cx: 490, cy: 700, r: 0.8, o: 0.4 },
  { cx: 610, cy: 660, r: 1.3, o: 0.7 },
  { cx: 720, cy: 720, r: 0.9, o: 0.5 },
  { cx: 100, cy: 740, r: 1, o: 0.55 },
];

export default function RadarBackdrop({
  className = 'absolute right-[-15%] top-1/2 -translate-y-1/2 w-[1100px] h-[1100px] opacity-90 pointer-events-none',
}: {
  className?: string;
}) {
  // Radial spokes every 30° from center to outer ring.
  const spokeAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 800"
      className={className}
    >
      <defs>
        <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#016FD4" stopOpacity="0.42" />
          <stop offset="55%" stopColor="#016FD4" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#016FD4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sweep-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4FA9F0" stopOpacity="0" />
          <stop offset="100%" stopColor="#4FA9F0" stopOpacity="0.55" />
        </linearGradient>
        {/* Subtle drop-shadow for the brighter dots. */}
        <filter id="blip-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* central radial glow */}
      <circle cx="400" cy="400" r="380" fill="url(#radar-glow)" />

      {/* radial spokes — every 30°, faint */}
      <g stroke="#4FA9F0" strokeOpacity="0.10" strokeWidth="0.8">
        {spokeAngles.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x2 = 400 + 380 * Math.cos(rad);
          const y2 = 400 + 380 * Math.sin(rad);
          return (
            <line key={deg} x1="400" y1="400" x2={x2.toFixed(2)} y2={y2.toFixed(2)} />
          );
        })}
      </g>

      {/* concentric rings — outer rings pulse, inner ones static */}
      <g style={{ animation: 'beacon-pulse 3s ease-in-out infinite' }}>
        <circle cx="400" cy="400" r="380" fill="none" stroke="#4FA9F0" strokeOpacity="0.40" strokeWidth="1.5" />
        <circle cx="400" cy="400" r="320" fill="none" stroke="#4FA9F0" strokeOpacity="0.32" strokeWidth="1" />
      </g>
      <circle cx="400" cy="400" r="240" fill="none" stroke="#016FD4" strokeOpacity="0.30" strokeWidth="1" />
      <circle cx="400" cy="400" r="160" fill="none" stroke="#016FD4" strokeOpacity="0.24" strokeWidth="1" />
      <circle cx="400" cy="400" r="80" fill="none" stroke="#016FD4" strokeOpacity="0.24" strokeWidth="1" />

      {/* scattered blip field — small dots across the canvas */}
      <g filter="url(#blip-glow)">
        {BLIPS.map((b, i) => (
          <circle
            key={i}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill="#67B5F2"
            opacity={b.o}
          />
        ))}
      </g>

      {/* slow rotating sweep wedge — 45° arc, endpoint sits exactly on r=380 */}
      <g
        style={{
          transformOrigin: '400px 400px',
          animation: 'beacon-sweep 8s linear infinite',
        }}
      >
        <path
          d="M 400 400 L 780 400 A 380 380 0 0 0 668.7 131.3 Z"
          fill="url(#sweep-grad)"
          opacity="0.45"
        />
      </g>

      {/* central beacon dot */}
      <circle
        cx="400"
        cy="400"
        r="6"
        fill="#67B5F2"
        style={{ animation: 'beacon-dot 2s ease-in-out infinite' }}
      />

      <style>{`
        @keyframes beacon-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes beacon-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes beacon-dot {
          0%, 100% { opacity: 0.6; r: 5; }
          50% { opacity: 1; r: 8; }
        }
      `}</style>
    </svg>
  );
}
