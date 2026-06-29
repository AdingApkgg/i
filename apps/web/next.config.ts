import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace workspace deps from the monorepo root (build runs with cwd = apps/web).
  outputFileTracingRoot: join(process.cwd(), "../../"),
  // Workspace packages ship raw TS/TSX; let Next transpile them.
  transpilePackages: ["@i/ui", "@i/api-client"],
  // Keep TS type errors fatal at build time — correctness must hold.
  typescript: { ignoreBuildErrors: false },
  // Production browser source maps are expensive to emit and not served.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
