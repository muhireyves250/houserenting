/**
 * Animated illustrations for the welcome slides. Outlines draw themselves (pathLength=1 + stroke-dashoffset),
 * then shapes fill with soft brand tones and small details move. All motion is CSS and stops with reduced motion.
 */

const STROKE = { stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const SOFT = "var(--color-primary-soft)";

/** An outline that draws itself after `delay` ms, then (optionally) fills. */
function Shape({ d, delay = 0, fill = "none" }: { d: string; delay?: number; fill?: string }) {
  return (
    <path
      d={d}
      pathLength={1}
      className={fill === "none" ? "art-draw" : "art-draw art-fill"}
      style={{ animationDelay: fill === "none" ? `${delay}ms` : `${delay}ms, ${delay + 700}ms`, ["--art-fill" as string]: fill }}
      fill={fill === "none" ? "none" : "transparent"}
      {...STROKE}
    />
  );
}

/** Soft background blob and ground shadow shared by all scenes. */
function Backdrop() {
  return (
    <>
      <ellipse cx="160" cy="120" rx="140" ry="92" fill={SOFT} opacity="0.45" className="art-pop" />
      <ellipse cx="160" cy="214" rx="120" ry="9" fill="var(--color-primary)" opacity="0.08" className="art-pop" style={{ animationDelay: "200ms" }} />
    </>
  );
}

/** Slide 1: a neighbourhood - house, apartment block and lodge - whose windows light up at dusk. */
function Homes() {
  const windows = [
    [146, 92], [170, 92], [146, 116], [170, 116], [146, 140], [170, 140], [146, 164], [170, 164],
    [70, 152], [104, 152], [232, 172], [252, 172],
  ];
  return (
    <svg viewBox="0 0 320 240" className="size-full text-primary" aria-hidden="true">
      <Backdrop />
      <g className="art-float">
        <circle cx="262" cy="52" r="16" fill="#ffd166" className="art-pop" style={{ animationDelay: "1300ms" }} />
      </g>
      <g className="art-float-slow">
        <Shape d="M40 62h44a12 12 0 0 0-12-14 16 16 0 0 0-29 6 9 9 0 0 0-3 8z" fill="#fff" delay={1100} />
      </g>
      <Shape d="M24 212h272" />
      {/* Apartment block */}
      <Shape d="M134 212V78a6 6 0 0 1 6-6h48a6 6 0 0 1 6 6v134" fill="#fff" delay={150} />
      <Shape d="M154 212v-22h20v22" delay={700} />
      {/* House */}
      <Shape d="M56 212v-62l38-30 38 30v62" fill="#fff" delay={300} />
      <Shape d="M48 156l46-38 46 38" delay={450} />
      <Shape d="M84 212v-30h20v30" delay={650} />
      {/* Lodge */}
      <Shape d="M222 212v-44l30-24 30 24v44" fill="#fff" delay={450} />
      {/* Tree */}
      <Shape d="M296 212v-34" delay={800} />
      <Shape d="M296 180c-14 0-18-14-9-22 0-12 18-12 18 0 9 8 5 22-9 22z" fill="#cfe7d8" delay={850} />
      {windows.map(([x, y], i) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="12" height="12" rx="2.5" className="art-light" style={{ animationDelay: `${1100 + i * 90}ms` }} />
      ))}
    </svg>
  );
}

/** Slide 2: a map unfolds, a route traces across it, a pin drops in and a magnifier glides over. */
function Location() {
  return (
    <svg viewBox="0 0 320 240" className="size-full text-primary" aria-hidden="true">
      <Backdrop />
      {/* Folded map, three panels */}
      <Shape d="M44 64l76-24v148l-76 24z" fill="#fff" />
      <Shape d="M120 40l80 24v148l-80-24z" fill="#f4f8fd" delay={150} />
      <Shape d="M200 64l76-24v148l-76 24z" fill="#fff" delay={300} />
      {/* Park and lake */}
      <Shape d="M62 150c10-12 30-12 40 0s-6 26-20 26-30-14-20-26z" fill="#cfe7d8" delay={600} />
      <Shape d="M222 96c12-8 34-6 40 6s-8 22-24 20-26-18-16-26z" fill="#cde3f7" delay={700} />
      {/* Route */}
      <path d="M58 118c40-4 56-46 100-42s58 54 104 40" pathLength={1} className="art-draw art-route" style={{ animationDelay: "800ms" }} fill="none" {...STROKE} strokeWidth={3} />
      {/* Pin */}
      <g className="art-drop" style={{ animationDelay: "1300ms" }}>
        <path d="M160 120c-20-22-28-34-28-48a28 28 0 0 1 56 0c0 14-8 26-28 48z" fill="var(--color-primary)" />
        <circle cx="160" cy="72" r="10" fill="#fff" />
      </g>
      <ellipse cx="160" cy="128" rx="14" ry="4" fill="currentColor" opacity="0.18" className="art-shadow" style={{ animationDelay: "1300ms" }} />
      {/* Magnifier */}
      <g className="art-glide" style={{ animationDelay: "1800ms" }}>
        <circle cx="234" cy="160" r="20" fill="#fff" {...STROKE} strokeWidth={3} />
        <circle cx="234" cy="160" r="12" fill={SOFT} opacity="0.7" />
        <path d="M249 175l16 16" {...STROKE} strokeWidth={7} />
      </g>
    </svg>
  );
}

/** Slide 3: a listing card draws itself, a heart pops in and beats, small hearts float up. */
function Favorites() {
  const heart = "M0 6C-6-2-16 2-12 10L0 22 12 10C16 2 6-2 0 6z";
  return (
    <svg viewBox="0 0 320 240" className="size-full text-primary" aria-hidden="true">
      <Backdrop />
      {/* Second card behind for depth */}
      <Shape d="M96 52h136a12 12 0 0 1 12 12v120a12 12 0 0 1-12 12H96a12 12 0 0 1-12-12V64a12 12 0 0 1 12-12z" fill="#eef4fb" />
      {/* Main card */}
      <Shape d="M78 66h136a12 12 0 0 1 12 12v120a12 12 0 0 1-12 12H78a12 12 0 0 1-12-12V78a12 12 0 0 1 12-12z" fill="#fff" delay={200} />
      {/* Photo area with a house */}
      <Shape d="M82 82h128v66H82z" fill={SOFT} delay={400} />
      <Shape d="M122 142v-26l24-20 24 20v26z" fill="#fff" delay={650} />
      <Shape d="M140 142v-14h12v14" delay={850} />
      {/* Text lines and rating stars */}
      <Shape d="M84 166h92M84 182h60" delay={900} />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={186 + i * 8} cy="182" r="2.6" fill="#ffd166" className="art-pop" style={{ animationDelay: `${1200 + i * 80}ms` }} />
      ))}
      {/* Heart badge: pops in, then beats */}
      <g transform="translate(212 76)">
        <circle r="22" fill="#fff" {...STROKE} strokeWidth={2} className="art-pop" style={{ animationDelay: "1100ms" }} />
        <g transform="translate(0 -9)">
          <g className="art-beat" style={{ animationDelay: "1300ms" }}>
            <path d={heart} fill="#e11d48" transform="scale(1.05)" />
          </g>
        </g>
      </g>
      {[
        [242, 58, 0], [262, 84, 600], [228, 40, 1200],
      ].map(([x, y, delay]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <g className="art-rise" style={{ animationDelay: `${1700 + delay}ms` }}>
            <path d={heart} fill="#e11d48" opacity="0.65" transform="scale(0.45)" />
          </g>
        </g>
      ))}
    </svg>
  );
}

export const WELCOME_ART = [Homes, Location, Favorites] as const;
