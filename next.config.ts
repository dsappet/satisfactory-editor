import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Mirror our committed icon set under /icons (see public/icons/). Locally
  // hosted images go through next/image's optimizer without any extra config.
  // No remotePatterns needed — we deliberately don't hotlink third parties.
};

export default nextConfig;
