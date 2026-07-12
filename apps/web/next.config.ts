import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Transpile the workspace TS packages (they ship raw src, not built dist).
  transpilePackages: ["@i/ui", "@i/db", "@i/config"],
  // @i/db's node deps must resolve at runtime, not be bundled by the server
  // compiler (Prisma's generated client + pg/ioredis native bits).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "ioredis"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default config;
