import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace workspace deps from the monorepo root (build runs with cwd = apps/web).
  outputFileTracingRoot: join(process.cwd(), "../../"),
  // Workspace packages ship raw TS/TSX; let Next transpile them.
  transpilePackages: ["@i/ui", "@i/api-client"],
};

export default nextConfig;
