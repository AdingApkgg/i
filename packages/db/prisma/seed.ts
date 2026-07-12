import { db } from "../src/client";

async function main() {
  await db.post.upsert({
    where: { slug: "hello-world" },
    update: {},
    create: {
      slug: "hello-world",
      title: "你好，世界 ✿",
      excerpt: "i 个人空间 v2 的第一篇文章。Next 全栈 · Prisma 7 · tRPC · better-auth · 粉粉的萌系设计。",
      contentMd:
        "# 你好，世界\n\n这是 **i** 个人空间的 v2 重写：\n\n- Next.js 全栈 + tRPC\n- Prisma 7 + Postgres + Redis\n- better-auth（管理员 + 访客）\n- Tailwind v4 萌系粉调 + Live2D\n\n慢慢长大中 ✿",
      tags: ["随笔"],
      status: "published",
      publishedAt: new Date(),
    },
  });
  console.log("✓ seeded sample post");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
