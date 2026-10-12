"use client";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as React from "react";
import type { AppRouter } from "@/server/router";

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

const link = new RPCLink({
  url: () => `${getBaseUrl()}/api/rpc`,
  fetch: (request, init) => globalThis.fetch(request, { ...init, credentials: "include" }),
});

/** 直接调用：`await client.friends.submit({...})`。 */
export const client: RouterClient<AppRouter> = createORPCClient(link);

/** TanStack Query 工具：`useQuery(orpc.comment.list.queryOptions({ input }))`。 */
export const orpc = createTanstackQueryUtils(client);

let qc: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") {
    return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  }
  qc ??= new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  return qc;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
