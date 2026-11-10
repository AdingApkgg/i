import { ORPCError } from "@orpc/server";
import { markDegraded } from "./degrade.server";
import type { HomeResult } from "./home-content";

/** 空结果和故障分别序列化；故障沿用请求级日志与禁止缓存保护。 */
export async function readHomeSection<T>(read: () => Promise<T[]>): Promise<HomeResult<T>> {
  try {
    return { status: "ready", items: await read() };
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return { status: "ready", items: [] };
    }
    markDegraded(error);
    return { status: "error", items: [] };
  }
}
