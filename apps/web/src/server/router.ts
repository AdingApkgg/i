import type { InferRouterInputs, InferRouterOutputs } from "@orpc/server";
import { bangumiRouter } from "./routers/bangumi";
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
import { dailyRecordRouter } from "./routers/daily-record";
import { dashStatsRouter } from "./routers/dash-stats";
import { friendsRouter } from "./routers/friends";
import { galleryRouter } from "./routers/gallery";
import { healthRouter } from "./routers/health";
import { maimaiRouter } from "./routers/maimai";
import { mediaRouter } from "./routers/media";
import { monitorRouter } from "./routers/monitor";
import { pageRouter } from "./routers/page";
import { postRouter } from "./routers/post";
import { translationRouter } from "./routers/translation";
import { vndbRouter } from "./routers/vndb";

export const router = {
  bangumi: bangumiRouter,
  dailyRecord: dailyRecordRouter,
  health: healthRouter,
  blog: postRouter,
  music: musicRouter,
  movie: movieRouter,
  vn: vnRouter,
  vndb: vndbRouter,
  translation: translationRouter,
  touhou: touhouRouter,
  device: deviceRouter,
  gallery: galleryRouter,
  albums: albumsRouter,
  moments: momentsRouter,
  friends: friendsRouter,
  monitor: monitorRouter,
  maimai: maimaiRouter,
  media: mediaRouter,
  comment: commentRouter,
  page: pageRouter,
  dashStats: dashStatsRouter,
};

export type AppRouter = typeof router;
export type RouterInputs = InferRouterInputs<AppRouter>;
export type RouterOutputs = InferRouterOutputs<AppRouter>;
