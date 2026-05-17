import { ImageResponse } from "next/og";

// Static OG image generated at build time. Self-contained (no external fonts
// or network fetches) so the privacy story stays intact and the build
// doesn't depend on third-party uptime.

export const alt =
  "Satisfactory Save Editor — edit your 1.2 .sav in the browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FICSIT_ORANGE = "#f29c14";
const FICSIT_ORANGE_BRIGHT = "#ffb13b";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #062a36 0%, #0e3c4a 60%, #11576b 100%)",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Hazard slash, lower-left corner — riff on the in-app hero */}
        <div
          style={{
            position: "absolute",
            left: -30,
            bottom: -10,
            width: 320,
            height: 70,
            display: "flex",
            transform: "rotate(-12deg)",
            background: `repeating-linear-gradient(90deg, ${FICSIT_ORANGE} 0 14px, transparent 14px 28px)`,
            opacity: 0.85,
          }}
        />

        {/* Accent strip along the bottom */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 6,
            display: "flex",
            background: `linear-gradient(90deg, transparent 0%, ${FICSIT_ORANGE} 30%, ${FICSIT_ORANGE_BRIGHT} 50%, ${FICSIT_ORANGE} 70%, transparent 100%)`,
          }}
        />

        {/* Eyebrow badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            fontWeight: 600,
            color: FICSIT_ORANGE_BRIGHT,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            border: `2px solid ${FICSIT_ORANGE}55`,
            borderRadius: 8,
            padding: "10px 18px",
            alignSelf: "flex-start",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: FICSIT_ORANGE_BRIGHT,
              display: "flex",
            }}
          />
          U1.2 · Save Editor
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 48,
            fontWeight: 800,
            fontSize: 132,
            lineHeight: 0.95,
            letterSpacing: "0.02em",
          }}
        >
          <div style={{ display: "flex", color: "rgba(255,255,255,0.92)" }}>
            SATISFACTORY
          </div>
          <div style={{ display: "flex", color: FICSIT_ORANGE_BRIGHT }}>
            EDITOR
          </div>
        </div>

        {/* Lede */}
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 32,
            color: "rgba(255,255,255,0.82)",
            maxWidth: 980,
            lineHeight: 1.3,
          }}
        >
          Edit your .sav in the browser. Purity, inventory, MAM research,
          hard-drive alternates — fully client-side. No upload. No backend.
        </div>

        {/* Footer line */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <div style={{ display: "flex" }}>satisfactory-editor.com</div>
          <div style={{ display: "flex" }}>Free · Privacy-first</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
