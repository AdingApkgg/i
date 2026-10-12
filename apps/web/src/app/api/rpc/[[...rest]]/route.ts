import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "@/server/orpc";
import { router } from "@/server/router";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      // 业务错误（ORPCError 4xx）是预期内的，只打意外异常
      if (error instanceof ORPCError && error.status < 500) return;
      console.error("[orpc]", error);
    }),
  ],
});

async function handle(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: await createContext({ headers: request.headers }),
  });
  return response ?? new Response("Not found", { status: 404 });
}

export { handle as GET, handle as POST };
