import { db, page, post } from "@i/db";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { backupJson, exportHtml } from "@/lib/content/export.server";
import { isAdminRole } from "@/lib/roles";
import { siteUrl } from "@/lib/site-url";

export function contentExportRoutes(database = db) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "private, no-store, no-transform");
    c.header("X-Content-Type-Options", "nosniff");
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    if (!session?.user) return c.json({ error: "请先登录" }, 401);
    if (!isAdminRole(session.user)) return c.json({ error: "仅管理员可导出内容" }, 403);
    await next();
  });
  const attachment = (body: string, name: string, format: "json" | "html") =>
    new Response(body, {
      headers: {
        // HTML 是供保存的附件；避免 CDN 按网页注入脚本或混淆正文里的邮箱。
        "Content-Type":
          format === "json" ? "application/json; charset=utf-8" : "application/octet-stream",
        "Content-Disposition": `attachment; filename="content.${format}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  app.get("/backup.json", async () => {
    // 同一快照读取两张表，备份期间的并发编辑不会产生跨表混合版本。
    const [posts, pages] = await database.transaction(
      async (tx) => [
        await tx.select().from(post).orderBy(asc(post.id)),
        await tx.select().from(page).orderBy(asc(page.id)),
      ],
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    return attachment(
      backupJson(posts, pages, siteUrl()),
      `content-backup-${new Date().toISOString().slice(0, 10)}.json`,
      "json",
    );
  });
  app.get("/:kind/:file", async (c) => {
    const kind = c.req.param("kind");
    if (kind !== "post" && kind !== "page") return c.json({ error: "不支持的内容类型" }, 400);
    const file = c.req.param("file"),
      dot = file.lastIndexOf(".");
    const id = file.slice(0, dot),
      format = file.slice(dot + 1);
    if (dot < 1 || (format !== "json" && format !== "html"))
      return c.json({ error: "不支持的导出格式" }, 400);
    const row =
      kind === "post"
        ? (await database.select().from(post).where(eq(post.id, id)))[0]
        : (await database.select().from(page).where(eq(page.id, id)))[0];
    if (!row) return c.json({ error: "内容不存在" }, 404);
    const slug = "slug" in row && typeof row.slug === "string" ? row.slug : row.id;
    const path =
      kind === "post" ? `/blog/${encodeURIComponent(slug)}` : `/${encodeURIComponent(slug)}`;
    const body =
      format === "json"
        ? backupJson(kind === "post" ? [row] : [], kind === "page" ? [row] : [], siteUrl())
        : exportHtml(row, path, siteUrl());
    return attachment(body, `${kind}-${slug}.${format}`, format);
  });
  app.onError((error, c) => {
    console.error("[content-export]", error);
    return c.json({ error: "导出失败，请稍后重试" }, 500);
  });
  return app;
}
