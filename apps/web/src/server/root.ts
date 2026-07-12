import { commentRouter } from "./routers/comment";
import {
  deviceRouter,
  friendsRouter,
  galleryRouter,
  momentsRouter,
  movieRouter,
  musicRouter,
  touhouRouter,
  vnRouter,
} from "./routers/content";
import { healthRouter } from "./routers/health";
import { maimaiRouter } from "./routers/maimai";
import { monitorRouter } from "./routers/monitor";
import { postRouter } from "./routers/post";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  blog: postRouter,
  music: musicRouter,
  movie: movieRouter,
  vn: vnRouter,
  touhou: touhouRouter,
  device: deviceRouter,
  gallery: galleryRouter,
  moments: momentsRouter,
  friends: friendsRouter,
  monitor: monitorRouter,
  maimai: maimaiRouter,
  comment: commentRouter,
});

export type AppRouter = typeof appRouter;
export { createCallerFactory };
export { createTRPCContext } from "./trpc";
