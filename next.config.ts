import type { NextConfig } from "next";

// CSP and friends. The privacy promise ("save never leaves your browser") is
// only as strong as the bundle the user actually runs — these headers make
// that promise verifiable from devtools without reading source.
//
// connect-src 'self' is the load-bearing line: it blocks any attempt to ship
// the parsed save (or anything else) to a third party. font-src is 'self'
// because next/font/google self-hosts at build time.
//
// 'unsafe-inline' for scripts and styles is accepted here because: there is
// no user-provided content that gets rendered as HTML, React escapes all JSX
// text, and adopting nonces would force every page to dynamic rendering for
// no real-world gain on this app. Revisit if a feature later reflects
// untrusted content.
//
// 'unsafe-eval' is dev-only — React's dev runtime uses eval for hydration
// error overlays. Production builds don't need it.
const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  // HSTS — only meaningful when served over HTTPS, harmless over HTTP since
  // browsers ignore it on insecure responses. 2y + preload is the standard
  // strict posture; drop `preload` if you might ever need to roll back.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // frame-ancestors 'none' in CSP supersedes this in modern browsers; kept
  // for legacy UAs.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  // We don't use any of these APIs. Locking them down keeps a future careless
  // dependency from silently prompting the user for permission.
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // CORP not COEP — COEP would require every cross-origin sub-resource to
  // opt in, which is overkill for an app that fetches none.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Mirror our committed icon set under /icons (see public/icons/). Locally
  // hosted images go through next/image's optimizer without any extra config.
  // No remotePatterns needed — we deliberately don't hotlink third parties.

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
