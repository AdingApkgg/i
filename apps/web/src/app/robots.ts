import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site-url";

// 运行时读 NEXT_PUBLIC_SITE_URL（构建期没有生产域名）
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dash", "/api/"] },
    sitemap: absUrl("/sitemap.xml"),
  };
}
