import type { NextConfig } from "next";
import { join } from "node:path";

// Served under /dash/ behind the bundled nginx in production; at root in dev.
const basePath = process.env.NODE_ENV === "production" ? "/dash" : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  outputFileTracingRoot: join(process.cwd(), "../../"),
  transpilePackages: ["@i/ui", "@i/api-client"],
  // Keep TS type errors fatal at build time — correctness must hold.
  typescript: { ignoreBuildErrors: false },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
