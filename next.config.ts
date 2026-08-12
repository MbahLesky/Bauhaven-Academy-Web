import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo sits beside its sibling apps under a Bauhaven root that has its
  // own lockfile (the root task runner). Without this, Next.js would infer that
  // root as the workspace root and trace files from outside this app.
  turbopack: { root: __dirname },
};

export default nextConfig;
