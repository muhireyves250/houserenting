/**
 * Animated line drawings for the welcome slides (brand blue on white). Strokes draw themselves
 * (pathLength=1 + stroke-dashoffset), then small details move. All motion is CSS and stops with reduced motion.
 */

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A stroke that draws itself after `delay` ms. */
function Draw({ d, delay = 0 }: { d: string; delay?: number }) {
  return <path d={d} pathLength={1} className="art-draw" style={{ animationDelay: `${delay}ms` }} {...STROKE} />;
}

/** Slide 1: a little neighbourhood - house, apartment block and lodge - whose windows light up. */
function Homes() {
  return (
    <svg viewBox="0 0 200 160" className="size-full text-primary" aria-hidden="true">
      {/* Sun and cloud */}
      <g className="art-float">
        <circle cx="160" cy="34" r="12" fill="#ffd166" className="art-pop" style={{ animationDelay: "1300ms" }} />
      </g>
      <g className="art-float-slow">
        <Draw d="M24 40h26a8 8 0 0 0-8-10 10 10 0 0 0-18 4 6 6 0 0 0 0 6z" delay={1100} />
      </g>
      {/* Ground */}
      <Draw d="M10 138h180" />
      {/* Apartment block */}
      <Draw d="M84 138V58h44v80" delay={150} />
      {/* House */}
      <Draw d="M24 138V96l26-22 26 22v42" delay={300} />
      <Draw d="M44 138v-20h12v20" delay={500} />
      {/* Lodge with tree */}
      <Draw d="M136 138v-30l20-16 20 16v30" delay={450} />
      <Draw d="M184 138v-26M184 112c-9 0-12-10-6-16 0-8 12-8 12 0 6 6 3 16-6 16z" delay={700} />
      {/* Windows light up one after another */}
      {[
        [92, 68], [112, 68], [92, 86], [112, 86], [92, 104], [112, 104], [32, 100], [60, 100], [148, 116], [160, 116],
      ].map(([x, y], i) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="9" height="9" rx="2" className="art-light" style={{ animationDelay: `${1000 + i * 110}ms` }} />
      ))}
    </svg>
  );
}

/** Slide 2: a map draws its roads, a pin drops in and bounces, a magnifier glides over. */
function Location() {
  return (
    <svg viewBox="0 0 200 160" className="size-full text-primary" aria-hidden="true">
      {/* Folded map */}
      <Draw d="M20 46l50-16 60 16 50-16v100l-50 16-60-16-50 16z" />
      <Draw d="M70 30v100M130 46v100" delay={250} />
      {/* Roads */}
      <path d="M28 104c30-6 40-34 70-30s40 30 74 18" pathLength={1} className="art-draw art-dash" style={{ animationDelay: "500ms" }} {...STROKE} strokeWidth={2.5} />
      {/* Pin */}
      <g className="art-drop" style={{ animationDelay: "1000ms" }}>
        <path d="M100 86c-14-16-20-24-20-34a20 20 0 0 1 40 0c0 10-6 18-20 34z" fill="var(--color-primary)" />
        <circle cx="100" cy="52" r="7" fill="#fff" />
      </g>
      <ellipse cx="100" cy="92" rx="10" ry="3" fill="currentColor" opacity="0.18" className="art-shadow" style={{ animationDelay: "1000ms" }} />
      {/* Magnifier */}
      <g className="art-glide" style={{ animationDelay: "1500ms" }}>
        <circle cx="150" cy="104" r="13" {...STROKE} fill="#fff" />
        <path d="M159 114l12 12" {...STROKE} strokeWidth={5} />
      </g>
    </svg>
  );
}

/** Slide 3: a home card draws itself, a heart pops in and beats, small hearts float up. */
function Favorites() {
  const heart = "M0 6C-6-2-16 2-12 10L0 22 12 10C16 2 6-2 0 6z";
  return (
    <svg viewBox="0 0 200 160" className="size-full text-primary" aria-hidden="true">
      {/* Card */}
      <Draw d="M48 30h104a10 10 0 0 1 10 10v84a10 10 0 0 1-10 10H48a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10z" />
      <Draw d="M62 92V70l20-16 20 16v22z" delay={300} />
      <Draw d="M58 108h56M58 118h36" delay={550} />
      {/* Big heart: pops in, then beats */}
      <g transform="translate(136 64)">
        <g className="art-beat" style={{ animationDelay: "900ms" }}>
          <path d={heart} fill="#e11d48" transform="scale(1.6)" />
        </g>
      </g>
      {/* Floating little hearts */}
      {[
        [120, 46, 0], [150, 40, 500], [166, 58, 1000],
      ].map(([x, y, delay]) => (
        <g key={`${x}`} transform={`translate(${x} ${y})`}>
          <g className="art-rise" style={{ animationDelay: `${1400 + delay}ms` }}>
            <path d={heart} fill="#e11d48" opacity="0.7" transform="scale(0.5)" />
          </g>
        </g>
      ))}
    </svg>
  );
}

export const WELCOME_ART = [Homes, Location, Favorites] as const;
