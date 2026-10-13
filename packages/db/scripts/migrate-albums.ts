/**
 * 幂等回填：历史数据把 Photo.title 当图集名用（同名一批），迁到 Album 表。
 * - 只处理 albumId 为空的照片：按 title 分组 → upsert 同名 Album → 回填 albumId
 * - 图集封面缺省取该组第一张（sortOrder asc, createdAt desc）
 * - 迁移后清空这批照片的 title（title 释放给单张图片标题）
 * 运行：bun scripts/migrate-albums.ts（需 DATABASE_URL；prod 部署后跑一次）
 */
import { and, asc, count, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "../src/client";
import { album, photo } from "../src/schema";

const unassigned = (title: string) => and(isNull(photo.albumId), eq(photo.title, title));

async function main() {
  const groups = await db
    .select({ title: photo.title, n: count() })
    .from(photo)
    .where(and(isNull(photo.albumId), ne(photo.title, "")))
    .groupBy(photo.title)
    .orderBy(asc(photo.title)); // 分组无序，固定按 title 保证 sortOrder 确定性
  if (groups.length === 0) {
    console.log("没有待迁移的照片 ✿");
    return;
  }

  for (const [i, g] of groups.entries()) {
    const [first] = await db
      .select()
      .from(photo)
      .where(unassigned(g.title))
      .orderBy(asc(photo.sortOrder), desc(photo.createdAt))
      .limit(1);
    await db
      .insert(album)
      .values({ name: g.title, coverUrl: first?.thumbUrl || first?.imageUrl, sortOrder: i })
      .onConflictDoNothing({ target: album.name });
    const [target] = await db.select().from(album).where(eq(album.name, g.title));
    const moved = await db
      .update(photo)
      .set({ albumId: target!.id, title: "" })
      .where(unassigned(g.title))
      .returning({ id: photo.id });
    console.log(`「${g.title}」→ ${moved.length} 张`);
  }
  console.log(`迁移完成：${groups.length} 个图集 ✿`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
