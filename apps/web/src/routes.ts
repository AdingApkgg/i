import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";

/**
 * 路由表（URL 与 Next 时代保持一致）。
 * API / auth / RSS / sitemap / robots / OG 图片由 Hono 处理，见 src/hono.ts。
 */
export default [
  // 外层 shell：播放器 / 看板娘，不受页面出错影响；内层布局负责顶栏和错误边界
  layout("routes/site/shell.tsx", [
    layout("routes/site/layout.tsx", [
      index("routes/site/home.tsx"),
      route("blog", "routes/site/blog.tsx"),
      route("blog/:slug", "routes/site/blog-post.tsx"),
      route("music", "routes/site/music.tsx"),
      route("anime", "routes/site/anime.tsx"),
      route("movie", "routes/site/movie.tsx"),
      route("vn", "routes/site/vn.tsx"),
      route("touhou", "routes/site/touhou.tsx"),
      route("device", "routes/site/device.tsx"),
      route("masturbation", "routes/site/masturbation.tsx"),
      route("gallery", "routes/site/gallery.tsx"),
      route("gallery/:album", "routes/site/gallery-album.tsx"),
      route("moments", "routes/site/moments.tsx"),
      route("friends", "routes/site/friends.tsx"),
      route("monitor", "routes/site/monitor.tsx"),
      route("maimai", "routes/site/maimai.tsx"),
      // 其余未匹配路径：带前台外壳的 404
      route("*", "routes/site/not-found.tsx"),
    ]),
  ]),
  ...prefix("dash", [
    route("login", "routes/dash/login.tsx"),
    layout("routes/dash/layout.tsx", [
      index("routes/dash/home.tsx"),
      route("blog", "routes/dash/blog.tsx"),
      route("blog/:id", "routes/dash/blog-edit.tsx"),
      route("pages", "routes/dash/pages.tsx"),
      route("pages/:id", "routes/dash/page-edit.tsx"),
      route("friends", "routes/dash/friends.tsx"),
      route("gallery", "routes/dash/gallery.tsx"),
      route("maimai", "routes/dash/maimai.tsx"),
      route("anime", "routes/dash/anime.tsx"),
      route("settings", "routes/dash/settings.tsx"),
      route("masturbation", "routes/dash/masturbation.tsx"),
      route(":domain", "routes/dash/domain.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
