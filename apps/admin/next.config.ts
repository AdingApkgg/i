import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@i/ui", "@i/api-client"],
};

export default nextConfig;
