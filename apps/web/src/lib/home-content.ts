import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "@/server/router";

type Api = RouterClient<AppRouter>;
export type HomePost = Awaited<ReturnType<Api["blog"]["list"]>>[number];
export type HomeMoment = Awaited<ReturnType<Api["moments"]["list"]>>[number];
export type HomeProject = Awaited<ReturnType<Api["project"]["list"]>>[number];

export type HomeResult<T> = { status: "ready" | "error"; items: T[] };
export type HomeState<T> = HomeResult<T> | { status: "loading"; items: T[] };
export type HomeContent = {
  posts: HomeResult<HomePost>;
  moments: HomeResult<HomeMoment>;
  projects: HomeResult<HomeProject>;
};

/** 保留接口的公开原文顺序，不重排、不修改记录，也不把草稿序列化进首页。 */
export const previewPosts = <T extends { status: string }>(items: T[]) =>
  items.filter((item) => item.status === "published").slice(0, 3);
export const previewShort = <T>(items: T[]) => items.slice(0, 2);
