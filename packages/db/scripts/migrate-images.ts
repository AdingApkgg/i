/**
 * One-shot re-hosting: pull remote images referenced by the DB into MinIO
 * (the `gallery` bucket, served back through /api/gallery/files/<key>) and
 * rewrite every reference in the database to point at the local copy.
 *
 * Sources scanned:
 *   - Post.contentMd   markdown ![](url) + html <img src="url">
 *   - Post.coverUrl    (a cover may itself be an image url)
 *   - Photo.imageUrl
 *   - Movie.coverUrl
 *   - Friend.avatarUrl
 *
 * Relative ("/img/…" or bare) urls resolve against https://gh.saop.cc .
 * Only http(s) image urls (webp/png/jpg/jpeg/gif) are considered.
 *
 *   bun packages/db/scripts/migrate-images.ts
 *
 * Env: S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET (see defaults below).
 */
import { createHash } from "node:crypto";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { db } from "../src/client";

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://minio:9000";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "minio";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "minio12345";
const S3_BUCKET = process.env.S3_BUCKET ?? "gallery";

const ORIGIN = "https://gh.saop.cc";
const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 30_000;

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: "us-east-1",
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
});

// ---------------- url helpers ----------------

const IMG_EXT_RE = /\.(webp|png|jpe?g|gif)$/i;

/** Resolve a raw reference to an absolute http(s) url (or null if unusable). */
function resolveUrl(raw: string | null | undefined): string | null {
  let s = (raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("<") && s.endsWith(">")) s = s.slice(1, -1).trim();
  if (s.startsWith("//")) s = `https:${s}`;
  else if (s.startsWith("/")) s = `${ORIGIN}${s}`;
  else if (!/^https?:\/\//i.test(s)) s = `${ORIGIN}/${s.replace(/^\.?\//, "")}`;
  return s;
}

/** True when u is an http(s) url whose path ends in a supported image ext. */
function isImageUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return IMG_EXT_RE.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** File extension for the storage key, derived from the url path. */
function extFromUrl(u: string): string {
  const m = new URL(u).pathname.match(IMG_EXT_RE);
  const e = (m?.[1] ?? "bin").toLowerCase();
  return e === "jpeg" ? "jpg" : e;
}

function guessContentType(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/** Pull every image reference out of a markdown/html blob (as written). */
function extractRefs(md: string): string[] {
  const out: string[] = [];
  // markdown: ![alt](url "title") — grab the url token, tolerate <url>
  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)/g)) {
    let u = m[1] ?? "";
    if (u.startsWith("<") && u.endsWith(">")) u = u.slice(1, -1);
    if (u) out.push(u);
  }
  // html: <img ... src="url"> — quoted or bare
  for (const m of md.matchAll(/<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const u = m[2] ?? m[3] ?? m[4] ?? "";
    if (u) out.push(u);
  }
  return out;
}

// resolvedUrl -> "/api/gallery/files/<key>" (only successfully uploaded)
const uploaded = new Map<string, string>();

/** Map an as-written reference to its new local path, or null if not re-hosted. */
function mapRef(raw: string | null | undefined): string | null {
  const resolved = resolveUrl(raw);
  if (!resolved || !isImageUrl(resolved)) return null;
  return uploaded.get(resolved) ?? null;
}

// ---------------- minio ----------------

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    } catch {
      // already exists / race — ignore
    }
  }
}

let uploadedCount = 0;
let failedCount = 0;

async function rehost(url: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      failedCount++;
      console.warn(`[skip] ${res.status} ${res.statusText} — ${url}`);
      return;
    }
    const body = new Uint8Array(await res.arrayBuffer());
    const ext = extFromUrl(url);
    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || guessContentType(ext);
    const key = `${createHash("sha1").update(url).digest("hex").slice(0, 16)}.${ext}`;
    await s3.send(
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
    uploaded.set(url, `/api/gallery/files/${key}`);
    uploadedCount++;
    console.log(`[ok] ${url} -> ${key}`);
  } catch (e) {
    failedCount++;
    console.warn(`[skip] ${url}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, worker: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx] as T);
    }
  });
  await Promise.all(runners);
}

// ---------------- main ----------------

async function main(): Promise<void> {
  await ensureBucket();

  const posts = await db.post.findMany({ select: { id: true, contentMd: true, coverUrl: true } });
  const photos = await db.photo.findMany({ select: { id: true, imageUrl: true } });
  const movies = await db.movie.findMany({ select: { id: true, coverUrl: true } });
  const friends = await db.friend.findMany({ select: { id: true, avatarUrl: true } });

  // 1) collect unique resolved image urls
  const found = new Set<string>();
  const consider = (raw: string | null | undefined) => {
    const resolved = resolveUrl(raw);
    if (resolved && isImageUrl(resolved)) found.add(resolved);
  };
  for (const p of posts) {
    for (const ref of extractRefs(p.contentMd)) consider(ref);
    consider(p.coverUrl);
  }
  for (const ph of photos) consider(ph.imageUrl);
  for (const mv of movies) consider(mv.coverUrl);
  for (const fr of friends) consider(fr.avatarUrl);

  const urls = [...found];
  console.log(`found ${urls.length} unique image url(s); re-hosting (concurrency ${CONCURRENCY})…`);

  // 2) fetch + upload
  await pool(urls, CONCURRENCY, rehost);

  // 3) rewrite the db
  let postsUpdated = 0;
  let photosUpdated = 0;
  let moviesUpdated = 0;
  let friendsUpdated = 0;

  for (const p of posts) {
    try {
      let content = p.contentMd;
      // build unique (asWritten -> newPath) pairs, replace longest-first so an
      // absolute url is rewritten before its embedded root-relative substring.
      const pairs = new Map<string, string>();
      for (const ref of extractRefs(content)) {
        const np = mapRef(ref);
        if (np) pairs.set(ref, np);
      }
      for (const [ref, np] of [...pairs].sort((a, b) => b[0].length - a[0].length)) {
        content = content.split(ref).join(np);
      }
      const newCover = mapRef(p.coverUrl) ?? p.coverUrl;
      if (content !== p.contentMd || newCover !== p.coverUrl) {
        await db.post.update({
          where: { id: p.id },
          data: { contentMd: content, coverUrl: newCover },
        });
        postsUpdated++;
      }
    } catch (e) {
      console.error(`[post ${p.id}] rewrite failed: ${String(e)}`);
    }
  }

  for (const ph of photos) {
    try {
      const np = mapRef(ph.imageUrl);
      if (np && np !== ph.imageUrl) {
        await db.photo.update({ where: { id: ph.id }, data: { imageUrl: np } });
        photosUpdated++;
      }
    } catch (e) {
      console.error(`[photo ${ph.id}] rewrite failed: ${String(e)}`);
    }
  }

  for (const mv of movies) {
    try {
      const np = mapRef(mv.coverUrl);
      if (np && np !== mv.coverUrl) {
        await db.movie.update({ where: { id: mv.id }, data: { coverUrl: np } });
        moviesUpdated++;
      }
    } catch (e) {
      console.error(`[movie ${mv.id}] rewrite failed: ${String(e)}`);
    }
  }

  for (const fr of friends) {
    try {
      const np = mapRef(fr.avatarUrl);
      if (np && np !== fr.avatarUrl) {
        await db.friend.update({ where: { id: fr.id }, data: { avatarUrl: np } });
        friendsUpdated++;
      }
    } catch (e) {
      console.error(`[friend ${fr.id}] rewrite failed: ${String(e)}`);
    }
  }

  console.log({
    found: urls.length,
    uploaded: uploadedCount,
    failed: failedCount,
    postsUpdated,
    photosUpdated,
    moviesUpdated,
    friendsUpdated,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
