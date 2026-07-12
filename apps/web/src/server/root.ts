import {
  deviceRouter,
  friendsRouter,
  galleryRouter,
  maimaiRouter,
  momentsRouter,
  monitorRouter,
  movieRouter,
  musicRouter,
  touhouRouter,
  vnRouter,
} from "./routers/content";
import { healthRouter } from "./routers/health";
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
});

export type AppRouter = typeof appRouter;
export { createCallerFactory };
export { createTRPCContext } from "./trpc";
