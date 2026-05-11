// Topographic-contour backdrop for sub-page sections. Tiled SVG, brand
// blue. Pure CSS, no JS, no image dependency.
export default function TopoBackdrop({
  className = 'absolute inset-0 pointer-events-none',
}: {
  className?: string;
}) {
  // Layer 1: organic contour curves.
  const contours = `
<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none'>
  <g stroke='#4FA9F0' stroke-opacity='0.55' stroke-width='1.1' fill='none'>
    <path d='M-20 80 C 30 60, 70 100, 120 80 S 220 60, 340 90' />
    <path d='M-20 110 C 40 90, 90 130, 140 110 S 230 95, 340 120' />
    <path d='M-20 140 C 50 120, 100 160, 150 140 S 240 130, 340 150' />
    <path d='M-20 170 C 60 150, 110 190, 160 170 S 250 160, 340 180' />
    <path d='M-20 200 C 50 190, 90 220, 140 205 S 240 200, 340 215' />
    <path d='M-20 230 C 70 215, 120 250, 170 235 S 260 225, 340 240' />
    <path d='M-20 260 C 60 245, 110 275, 160 260 S 250 250, 340 265' />
    <path d='M-20 290 C 80 275, 130 305, 180 290 S 260 280, 340 295' />
    <path d='M-20 50 C 40 30, 80 70, 130 50 S 230 30, 340 60' />
    <path d='M-20 20 C 60 5, 100 35, 150 20 S 250 0, 340 25' />
  </g>
</svg>`;

  // Layer 2: thin grid for "tactical chart" feel.
  const grid = `
<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80' fill='none'>
  <path d='M 80 0 L 0 0 0 80' fill='none' stroke='#4FA9F0' stroke-opacity='0.18' stroke-width='0.6'/>
</svg>`;

  const enc = (s: string) => encodeURIComponent(s.trim()).replace(/'/g, '%27');

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        backgroundImage: `url("data:image/svg+xml,${enc(contours)}"), url("data:image/svg+xml,${enc(grid)}")`,
        backgroundSize: '320px 320px, 80px 80px',
        backgroundRepeat: 'repeat, repeat',
        opacity: 0.7,
      }}
    />
  );
}
