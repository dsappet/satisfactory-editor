import { ThemeToggle } from "@/components/theme-toggle";
import { EventFilterToggle } from "@/components/event-filter-toggle";

/**
 * Inline-SVG hero. Self-contained, no external assets.
 *
 * Visual language:
 * - Deep teal background gradient (Satisfactory's water/sky palette).
 * - FICSIT orange accent (deliberately our own variant — `--ficsit-orange`).
 * - Subtle factory grid + isometric pipe pattern in the background.
 * - Hazard stripes in the bottom-left corner.
 * - "SATISFACTORY EDITOR" wordmark in Oxanium (the closest free analogue to
 *   the in-game industrial-tech UI typography).
 */
export function Hero() {
  return (
    <section
      aria-label="Satisfactory Save Editor"
      className="relative isolate overflow-hidden rounded-2xl border border-white/10"
      style={{
        background:
          "linear-gradient(135deg, var(--ficsit-deep) 0%, var(--ficsit-teal) 60%, #11576b 100%)",
      }}
    >
      {/* Background grid + pipes */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 360"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="hero-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="hero-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(242,156,20,0.0)" />
            <stop offset="60%" stopColor="rgba(242,156,20,0.12)" />
            <stop offset="100%" stopColor="rgba(242,156,20,0.28)" />
          </linearGradient>
          <linearGradient id="hazard" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f5d000" />
            <stop offset="100%" stopColor="#f29c14" />
          </linearGradient>
        </defs>

        <rect width="1200" height="360" fill="url(#hero-grid)" />
        <rect width="1200" height="360" fill="url(#hero-glow)" />

        {/* Stylised pipes / conveyors snaking across the background */}
        <g
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M -20 80 Q 200 80 240 130 T 520 180 T 820 200 T 1220 240" />
          <path d="M -20 240 Q 180 240 240 200 T 540 160 Q 700 140 900 160 T 1220 120" />
        </g>
        <g
          stroke="var(--ficsit-orange)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        >
          <path d="M 760 40 L 760 100 Q 760 130 790 130 L 1100 130" />
          <path d="M 1020 220 L 1020 280 Q 1020 310 1050 310 L 1200 310" />
        </g>

        {/* Bolts at pipe corners */}
        {[
          [760, 100],
          [790, 130],
          [1100, 130],
          [1020, 280],
          [1050, 310],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill="var(--ficsit-orange)"
            opacity="0.9"
          />
        ))}

        {/* Diagonal hazard slash, lower-left */}
        <g transform="translate(-20 320) rotate(-12)">
          {Array.from({ length: 9 }).map((_, i) => (
            <rect
              key={i}
              x={i * 28}
              y="0"
              width="14"
              height="60"
              fill="url(#hazard)"
              opacity="0.85"
            />
          ))}
        </g>

        {/* Faint factory silhouette, far right */}
        <g fill="rgba(0,0,0,0.25)">
          <rect x="980" y="240" width="40" height="80" />
          <rect x="1020" y="210" width="60" height="110" />
          <rect x="1080" y="250" width="30" height="70" />
          <rect x="1110" y="220" width="50" height="100" />
          <rect x="1160" y="260" width="40" height="60" />
          <rect x="1030" y="180" width="10" height="30" />
          <rect x="1130" y="190" width="10" height="30" />
        </g>
      </svg>

      {/* Foreground content */}
      <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-12 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-2 rounded-md border border-[color:var(--ficsit-orange)]/40 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ficsit-orange-bright)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-[color:var(--ficsit-orange-bright)]"
            />
            U1.2 · Save editor
          </div>

          <h1
            className="mt-4 font-extrabold text-white leading-[0.95] tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5.5vw, 3.5rem)",
              letterSpacing: "0.02em",
            }}
          >
            <span className="block text-white/90">SATISFACTORY</span>
            <span
              className="block"
              style={{
                color: "var(--ficsit-orange-bright)",
                textShadow: "0 0 30px rgba(242,156,20,0.35)",
              }}
            >
              EDITOR
            </span>
          </h1>

          <p
            className="mt-4 max-w-xl text-sm sm:text-base text-white/75"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Edit your <code className="text-white">.sav</code> in the browser.
            Resource purity, inventory slots, and more — all client-side, no
            uploads, no backend.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <EventFilterToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Bottom border light bar — riff on the in-game UI accent strips */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--ficsit-orange) 30%, var(--ficsit-orange-bright) 50%, var(--ficsit-orange) 70%, transparent 100%)",
        }}
      />
    </section>
  );
}
