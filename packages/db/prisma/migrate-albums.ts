/**
 * 幂等回填：历史数据把 Photo.title 当图集名用（同名一批），迁到 Album 表。
 * - 只处理 albumId 为空的照片：按 title 分组 → upsert 同名 Album → 回填 albumId
 * - 图集封面缺省取该组第一张（sortOrder asc, createdAt desc）
 * - 迁移后清空这批照片的 title（title 释放给单张图片标题）
 * 运行：bun prisma/migrate-albums.ts（需 DATABASE_URL；prod 部署后跑一次）
 */
import { db } from "../src/client";

async function main() {
  const groups = await db.photo.groupBy({
    by: ["title"],
    where: { albumId: null, title: { not: "" } },
    _count: true,
    orderBy: { title: "asc" }, // 分组无序，固定按 title 保证 sortOrder 确定性
  });
  if (groups.length === 0) {
    console.log("没有待迁移的照片 ✿");
    return;
  }

  for (const [i, g] of groups.entries()) {
    const first = await db.photo.findFirst({
      where: { albumId: null, title: g.title },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    const album = await db.album.upsert({
      where: { name: g.title },
      update: {},
      create: {
        name: g.title,
        coverUrl: first?.thumbUrl || first?.imageUrl,
        sortOrder: i,
      },
    });
    const moved = await db.photo.updateMany({
      where: { albumId: null, title: g.title },
      data: { albumId: album.id, title: "" },
    });
    console.log(`「${g.title}」→ ${moved.count} 张`);
  }
  console.log(`迁移完成：${groups.length} 个图集 ✿`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
