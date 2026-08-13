import { lookup } from "node:dns/promises";
import net from "node:net";
import { siteConfig } from "@i/config";
import { db } from "@i/db";

/**
 * MX Space 式友链健康检查：
 *  - 存活探测：连续 3 次不可达的 active 友链标记为 outdate（失联），恢复可达则回到 active。
 *  - 反链检测：抓取对方页面 HTML，查找本站域名，结果仅在后台展示供审核参考。
 *
 * 抓取的是访客提交的任意 URL，所以做了基本的 SSRF 防护：只允许 http(s)、
 * 逐跳手动跟随重定向、每跳解析 DNS 并拒绝私网/保留地址（DNS rebinding 这类
 * 更刁钻的绕过对个人站不设防，风险可接受）。
 */

const TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const OUTDATE_AFTER_FAILS = 3;
const UA =
  "Mozilla/5.0 (compatible; i-friend-checker/1.0; +" +
  (process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url) +
  ")";

/** Hosts whose appearance in the friend's HTML counts as a backlink. */
function backlinkHosts(): string[] {
  const hosts = new Set<string>();
  try {
    const h = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url).hostname;
    hosts.add(h);
    const parts = h.split(".");
    // Apex domain too (i.saop.cc → saop.cc): friends often link an older subdomain.
    if (parts.length > 2) hosts.add(parts.slice(-2).join("."));
  } catch {
    /* unparsable site url — rely on the env override below */
  }
  for (const extra of (process.env.FRIEND_BACKLINK_HOSTS ?? "").split(",")) {
    const t = extra.trim();
    if (t) hosts.add(t.toLowerCase());
  }
  return [...hosts];
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7)); // IPv4-mapped
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") || // fc00::/7 ULA
      lower.startsWith("fd") ||
      lower.startsWith("fe80") // link-local
    );
  }
  const [a = -1, b = -1] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** dev 环境（本机 compose）放开私网限制，方便本地联调。 */
const ALLOW_PRIVATE = process.env.NODE_ENV !== "production";

async function isFetchableUrl(u: URL): Promise<boolean> {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (ALLOW_PRIVATE) return true;
  try {
    const { address } = await lookup(u.hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

/** Stream the body up to `cap` bytes, then cancel — don't buffer 500MB pages. */
async function readCapped(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, cap);
  const chunks: Buffer[] = [];
  let size = 0;
  while (size < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
    size += value.byteLength;
  }
  void reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8", 0, Math.min(size, cap));
}

async function fetchPage(url: string): Promise<{ ok: boolean; html: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return { ok: false, html: "" };
    }
    if (!(await isFetchableUrl(u))) return { ok: false, html: "" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(u, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "user-agent": UA, accept: "text/html,*/*" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, html: "" };
        current = new URL(loc, u).toString();
        continue; // 下一跳重新过 SSRF 校验
      }
      if (res.status < 200 || res.status >= 300) return { ok: false, html: "" };
      const html = await readCapped(res, MAX_HTML_BYTES);
      return { ok: true, html };
    } catch {
      return { ok: false, html: "" };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, html: "" }; // 重定向太多
}

interface FriendRow {
  id: string;
  url: string;
  status: string;
  failCount: number;
}

/**
 * Probe one friend and persist reachable/backlinked/checkedAt. Status is only
 * touched via conditional writes (outdate→active on recovery, active→outdate
 * after N fails), so a concurrent approve/reject/edit is never clobbered by a
 * stale snapshot taken before the fetch.
 */
export async function checkFriend(f: FriendRow) {
  const { ok, html } = await fetchPage(f.url);
  const now = new Date();
  if (ok) {
    const lower = html.toLowerCase();
    const backlinked = backlinkHosts().some((h) => lower.includes(h));
    const updated = await db.friend.update({
      where: { id: f.id },
      data: { reachable: true, backlinked, failCount: 0, checkedAt: now },
    });
    await db.friend.updateMany({
      where: { id: f.id, status: "outdate" },
      data: { status: "active" },
    });
    return updated;
  }
  const fails = f.failCount + 1;
  const updated = await db.friend.update({
    where: { id: f.id },
    data: { reachable: false, failCount: fails, checkedAt: now },
  });
  if (fails >= OUTDATE_AFTER_FAILS) {
    await db.friend.updateMany({
      where: { id: f.id, status: "active" },
      data: { status: "outdate" },
    });
  }
  return updated;
}

/** Check every active/outdate friend, sequentially (be polite to small blogs). */
export async function runFriendChecks() {
  const friends = await db.friend
    .findMany({
      where: { status: { in: ["active", "outdate"] } },
      select: { id: true, url: true, status: true, failCount: true },
    })
    .catch(() => [] as FriendRow[]);
  for (const f of friends) {
    await checkFriend(f).catch(() => {});
  }
  return friends.length;
}

/** Start the periodic loop (every 12h, first pass shortly after boot). */
export function startFriendCheckScheduler() {
  setTimeout(() => void runFriendChecks().catch(() => {}), 30_000);
  setInterval(() => void runFriendChecks().catch(() => {}), 12 * 3600 * 1000);
}
