import { db } from "../src/client";

const img = (seed: string) => `https://picsum.photos/seed/${seed}/400/560`;

async function main() {
  await db.post.upsert({
    where: { slug: "hello-world" },
    update: {},
    create: {
      slug: "hello-world",
      title: "你好，世界 ✿",
      excerpt: "i 个人空间 v2 的第一篇文章。Next 全栈 · Prisma 7 · tRPC · better-auth · 粉粉的萌系设计。",
      contentMd:
        "# 你好，世界\n\n这是 **i** 个人空间的 v2 重写：\n\n- Next.js 全栈 + tRPC\n- Prisma 7 + Postgres + Redis\n- better-auth（管理员 + 访客）\n- Tailwind v4 萌系粉调 + Live2D\n\n> 慢慢长大中 ✿",
      tags: ["随笔"],
      status: "published",
      publishedAt: new Date(),
    },
  });

  if ((await db.track.count()) === 0)
    await db.track.createMany({
      data: [
        { title: "secret base ～君がくれたもの～", artist: "ZONE", status: "在听", rating: 10, coverUrl: img("music1") },
        { title: "Snow halation", artist: "μ's", album: "Love Live!", status: "听过", rating: 9, coverUrl: img("music2") },
        { title: "光るなら", artist: "Goose house", status: "想听", coverUrl: img("music3") },
      ],
    });

  if ((await db.movie.count()) === 0)
    await db.movie.createMany({
      data: [
        { title: "你的名字。", category: "电影", status: "看过", rating: 10, year: 2016, coverUrl: img("movie1") },
        { title: "孤独摇滚！", category: "剧集", status: "在看", rating: 10, year: 2022, coverUrl: img("movie2") },
        { title: "铃芽之旅", category: "电影", status: "想看", year: 2022, coverUrl: img("movie3") },
      ],
    });

  if ((await db.vn.count()) === 0)
    await db.vn.createMany({
      data: [
        { title: "CLANNAD", brand: "Key", status: "通关", rating: 10, playHours: 60, coverUrl: img("vn1") },
        { title: "Summer Pockets", brand: "Key", status: "在玩", playHours: 20, coverUrl: img("vn2") },
      ],
    });

  if ((await db.touhou.count()) === 0)
    await db.touhou.createMany({
      data: [
        { title: "东方红魔乡", category: "game", status: "通关", rating: 9, coverUrl: img("th1") },
        { title: "东方妖々梦", category: "game", status: "收藏", coverUrl: img("th2") },
      ],
    });

  if ((await db.device.count()) === 0)
    await db.device.createMany({
      data: [
        { name: "MacBook Pro 14", category: "电脑", spec: "M3 Pro / 36G", status: "在用", acquired: "2024-01" },
        { name: "iPhone 15 Pro", category: "手机", spec: "256G 原色钛金属", status: "在用", acquired: "2023-09" },
      ],
    });

  if ((await db.photo.count()) === 0)
    await db.photo.createMany({
      data: [
        { title: "海边", imageUrl: "https://picsum.photos/seed/umi/800/800", takenAt: "2024-08" },
        { title: "樱花", imageUrl: "https://picsum.photos/seed/sakura/800/800", takenAt: "2024-04" },
        { title: "街道", imageUrl: "https://picsum.photos/seed/machi/800/800", takenAt: "2024-06" },
      ],
    });

  if ((await db.moment.count()) === 0)
    await db.moment.createMany({
      data: [
        { content: "把个人空间用 Next 全栈重写了一遍，粉粉的好可爱 (｡･ω･｡)", mood: "开心" },
        { content: "tRPC + Prisma 真香，端到端类型安全。", mood: "满足" },
      ],
    });

  if ((await db.friend.count()) === 0)
    await db.friend.createMany({
      data: [
        { name: "lemonkoi", url: "https://example.com", description: "一只写代码的猫", status: "active" },
        { name: "wikimoe", url: "https://example.org", description: "萌系插画站", status: "active" },
      ],
    });

  if ((await db.monitor.count()) === 0)
    await db.monitor.createMany({
      data: [
        { name: "本站", target: "https://i.saop.cc", kind: "http", enabled: true },
        { name: "GitHub", target: "https://github.com", kind: "http", enabled: true },
      ],
    });

  if ((await db.maimaiScore.count()) === 0)
    await db.maimaiScore.createMany({
      data: [
        { songTitle: "系ぐ", difficulty: "MASTER", level: "13", achievement: 100.5, rank: "SSS+", comboFlag: "AP" },
        { songTitle: "PANDORA PARADOXXX", difficulty: "RE:MASTER", level: "15", achievement: 99.8, rank: "SSS" },
      ],
    });

  console.log("✓ seeded sample content across domains");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
