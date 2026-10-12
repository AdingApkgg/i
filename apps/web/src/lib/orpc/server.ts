import "server-only";
import { createRouterClient } from "@orpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import { createContext } from "@/server/orpc";
import { router } from "@/server/router";

// 同一次 RSC 渲染里的多次调用共用一份 context（session 只查一次）
const getContext = cache(async () => createContext({ headers: await headers() }));

/** RSC / 服务端直调：不走 HTTP，`await api.blog.list()`。 */
export const api = createRouterClient(router, { context: getContext });
