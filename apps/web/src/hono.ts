/**
 * 服务端入口（react-router-hono-server）：Hono 先处理 API / auth / 订阅 / 分享卡片，
 * 其余请求交给 React Router 渲染页面。开发（Vite）与生产共用这一个入口。
 */
import { createHonoServer } from "react-router-hono-server/node";
import { cachePolicy } from "./server/cache";
import { startFriendCheckScheduler } from "./server/friend-check";
import { http } from "./server/http";
import { startMonitorScheduler } from "./server/monitor-scheduler";

// 后台定时任务：站点监控 30s 一轮、友链检测 12h 一轮。
// 开发时入口可能被 Vite 重新加载，用全局标记保证每个进程只启动一次。
const g = globalThis as unknown as { __schedulersStarted?: boolean };
if (!g.__schedulersStarted && process.env.DISABLE_SCHEDULERS !== "1") {
  g.__schedulersStarted = true;
  startMonitorScheduler();
  startFriendCheckScheduler();
}

export default await createHonoServer({
  defaultLogger: false,
  // 最外层：给所有响应（含静态资源、页面）补齐缓存头
  beforeAll(app) {
    app.use("*", cachePolicy);
  },
  configure(app) {
    app.route("/", http);
  },
});
