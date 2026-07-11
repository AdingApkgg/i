/**
 * Typed client for the Rust API.
 *
 * `schema.d.ts` is GENERATED from the backend's OpenAPI spec — do not edit it.
 * Regenerate with `just gen-api` (runs the api's `--openapi` dump through
 * openapi-typescript). The thin wrappers below give call sites stable names.
 */
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// NEXT_PUBLIC_API_URL is inlined by Next because this package is in both apps'
// `transpilePackages`. Outside Next, pass the base URL explicitly instead.
export const api = createClient<paths>({ baseUrl });

/* ---- admin auth token ------------------------------------------------
 * The admin CMS logs in (password -> JWT) and stores the token here; the
 * middleware below attaches it as a Bearer header on every request, so the
 * admin-protected blog mutations authenticate automatically.
 */
const TOKEN_KEY = "i.admin.token";
let authToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;

api.use({
  onRequest({ request }) {
    if (authToken) request.headers.set("authorization", `Bearer ${authToken}`);
    return request;
  },
});

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
}
export function getAuthToken(): string | null {
  return authToken;
}

export type Post = components["schemas"]["Post"];
export type UpsertPost = components["schemas"]["UpsertPost"];
export type CountResp = components["schemas"]["CountResp"];
export type Track = components["schemas"]["Track"];
export type Vn = components["schemas"]["Vn"];

export async function getCount(path: string): Promise<CountResp> {
  const { data, error } = await api.GET("/api/analytics/count", {
    params: { query: { path } },
  });
  if (error || !data) throw new Error("analytics/count failed");
  return data;
}

export async function listPosts(): Promise<Post[]> {
  const { data, error } = await api.GET("/api/blog/posts");
  if (error || !data) throw new Error("blog/posts failed");
  return data;
}

export async function login(password: string): Promise<{ token: string }> {
  const { data, error } = await api.POST("/api/auth/login", {
    body: { password },
  });
  if (error || !data) throw new Error("auth/login failed");
  return data;
}

/* ---- blog ------------------------------------------------------------ */

export async function getPost(slug: string): Promise<Post> {
  const { data, error } = await api.GET("/api/blog/posts/{slug}", {
    params: { path: { slug } },
  });
  if (error || !data) throw new Error("blog/get failed");
  return data;
}

export async function createPost(body: UpsertPost): Promise<Post> {
  const { data, error } = await api.POST("/api/blog/posts", { body });
  if (error || !data) throw new Error("blog/create failed");
  return data;
}

export async function updatePost(slug: string, body: UpsertPost): Promise<Post> {
  const { data, error } = await api.PUT("/api/blog/posts/{slug}", {
    params: { path: { slug } },
    body,
  });
  if (error || !data) throw new Error("blog/update failed");
  return data;
}

export async function deletePost(slug: string): Promise<void> {
  const { error } = await api.DELETE("/api/blog/posts/{slug}", {
    params: { path: { slug } },
  });
  if (error) throw new Error("blog/delete failed");
}

/* ---- media ------------------------------------------------------------
 * Uploaded gallery images are stored in MinIO and served by the API at a
 * RELATIVE path (`/api/gallery/files/<key>`). Resolve such paths against the
 * API base so they load in dev (cross-origin :8080); in prod the base is empty
 * (same-origin through nginx) and the path is returned unchanged.
 */
export function resolveMedia(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return url;
}

/**
 * Upload an image to the gallery bucket (admin-only, multipart). Returns the
 * relative `image_url` the backend stored it under; feed it back into a Photo's
 * `image_url` and render via {@link resolveMedia}.
 */
export async function uploadGalleryImage(file: File): Promise<{ image_url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const headers: Record<string, string> = {};
  const tok = getAuthToken();
  if (tok) headers.authorization = `Bearer ${tok}`;
  const res = await fetch(`${baseUrl}/api/gallery/upload`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error(`gallery/upload -> ${res.status}`);
  return res.json() as Promise<{ image_url: string }>;
}

// /health is intentionally undocumented (dynamic), so it stays a raw fetch.
export interface Health {
  db: boolean;
  redis: boolean;
}
export async function getHealth(): Promise<Health> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error("health failed");
  return res.json() as Promise<Health>;
}

/**
 * Generic authed request for the config-driven admin (dynamic per-domain paths
 * that openapi-fetch can't type without a literal path). Attaches the admin
 * Bearer token. Front-end code with known literal paths should prefer `api`.
 */
export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const tok = getAuthToken();
  if (tok) headers.authorization = `Bearer ${tok}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
