import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Purely a dev-mode convenience badge (route/build status) — off since
  // it's not used here. Compile/runtime error overlays still show either
  // way; this only hides the small on-screen indicator.
  devIndicators: false,
};

export default nextConfig;
