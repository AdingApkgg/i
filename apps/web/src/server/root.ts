import { healthRouter } from "./routers/health";
import { postRouter } from "./routers/post";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  post: postRouter,
});

export type AppRouter = typeof appRouter;
export { createCallerFactory };
export { createTRPCContext } from "./trpc";
