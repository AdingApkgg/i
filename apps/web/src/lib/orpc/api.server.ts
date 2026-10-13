import { createRouterClient, type RouterClient } from "@orpc/server";
import { createContext } from "@/server/orpc";
import { type AppRouter, router } from "@/server/router";

const perRequest = new WeakMap<Request, RouterClient<AppRouter>>();

/**
 * loader 里服务端直调 oRPC（不走 HTTP）：`await serverApi(request).blog.list()`。
 * 同一个请求复用一份 context，session 只查一次。
 * `.server.ts` 后缀：React Router 会拒绝把它打进浏览器包。
 */
export function serverApi(request: Request): RouterClient<AppRouter> {
  let api = perRequest.get(request);
  if (!api) {
    const context = createContext({ headers: request.headers });
    api = createRouterClient(router, { context: () => context });
    perRequest.set(request, api);
  }
  return api;
}
