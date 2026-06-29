import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(process.cwd(), "../../"),
  transpilePackages: ["@i/ui", "@i/api-client"],
};

export default nextConfig;
