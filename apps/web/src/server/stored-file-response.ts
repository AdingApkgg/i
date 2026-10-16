import { CACHE } from "./cache";

/** 保留 S3 的分段读取契约，避免视频跳播时退回完整文件响应。 */
export function storedFileResponse(object: Response): Response {
  const headers = new Headers(object.ok ? CACHE.immutable : CACHE.none);
  headers.set("content-type", object.headers.get("content-type") ?? "application/octet-stream");
  for (const name of [
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = object.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Response(object.body, { status: object.status, headers });
}
