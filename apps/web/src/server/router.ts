import type { InferRouterInputs, InferRouterOutputs } from "@orpc/server";
import { commentRouter } from "./routers/comment";
import {
  albumsRouter,
  deviceRouter,
  momentsRouter,
  movieRouter,
  musicRouter,
  touhouRouter,
  vnRouter,
} from "./routers/content";
import { friendsRouter } from "./routers/friends";
import { galleryRouter } from "./routers/gallery";
import { healthRouter } from "./routers/health";
import { maimaiRouter } from "./routers/maimai";
import { monitorRouter } from "./routers/monitor";
import { pageRouter } from "./routers/page";
import { postRouter } from "./routers/post";

export const router = {
  health: healthRouter,
  blog: postRouter,
  music: musicRouter,
  movie: movieRouter,
  vn: vnRouter,
  touhou: touhouRouter,
  device: deviceRouter,
  gallery: galleryRouter,
  albums: albumsRouter,
  moments: momentsRouter,
  friends: friendsRouter,
  monitor: monitorRouter,
  maimai: maimaiRouter,
  comment: commentRouter,
  page: pageRouter,
};

export type AppRouter = typeof router;
export type RouterInputs = InferRouterInputs<AppRouter>;
export type RouterOutputs = InferRouterOutputs<AppRouter>;
