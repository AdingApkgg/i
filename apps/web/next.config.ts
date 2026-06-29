import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TS/TSX; let Next transpile them.
  transpilePackages: ["@i/ui", "@i/api-client"],
};

export default nextConfig;
