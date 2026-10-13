import { eq } from "drizzle-orm";
import { db } from "../src/client";
import {
  album,
  device,
  friend,
  moment,
  monitor,
  movie,
  photo,
  post,
  touhou,
  track,
  vn,
} from "../src/schema";

const img = (seed: string) => `https://picsum.photos/seed/${seed}/400/560`;

async function main() {
  await db
    .insert(post)
    .values({
      slug: "hello-world",
      title: "你好，世界 ✿",
      excerpt:
        "i 个人空间 v2 的第一篇文章。Hono + React Router 全栈 · Drizzle · oRPC · better-auth · 粉粉的萌系设计。",
      contentMd:
        "# 你好，世界\n\n这是 **i** 个人空间的 v2 重写：\n\n- Hono + React Router 全栈 + oRPC\n- Drizzle + Postgres + Redis\n- better-auth（管理员 + 访客）\n- Tailwind v4 萌系粉调 + Live2D\n\n> 慢慢长大中 ✿",
      tags: ["随笔"],
      status: "published",
      publishedAt: new Date(),
    })
    .onConflictDoNothing({ target: post.slug });

  if ((await db.$count(track)) === 0)
    await db.insert(track).values([
      {
        title: "secret base ～君がくれたもの～",
        artist: "ZONE",
        status: "在听",
        rating: 10,
        coverUrl: img("music1"),
      },
      {
        title: "Snow halation",
        artist: "μ's",
        album: "Love Live!",
        status: "听过",
        rating: 9,
        coverUrl: img("music2"),
      },
      { title: "光るなら", artist: "Goose house", status: "想听", coverUrl: img("music3") },
    ]);

  if ((await db.$count(movie)) === 0)
    await db.insert(movie).values([
      {
        title: "你的名字。",
        category: "电影",
        status: "看过",
        rating: 10,
        year: 2016,
        coverUrl: img("movie1"),
      },
      {
        title: "孤独摇滚！",
        category: "剧集",
        status: "在看",
        rating: 10,
        year: 2022,
        coverUrl: img("movie2"),
      },
      {
        title: "铃芽之旅",
        category: "电影",
        status: "想看",
        year: 2022,
        coverUrl: img("movie3"),
      },
    ]);

  if ((await db.$count(vn)) === 0)
    await db.insert(vn).values([
      {
        title: "CLANNAD",
        brand: "Key",
        status: "通关",
        rating: 10,
        playHours: 60,
        coverUrl: img("vn1"),
      },
      {
        title: "Summer Pockets",
        brand: "Key",
        status: "在玩",
        playHours: 20,
        coverUrl: img("vn2"),
      },
    ]);

  if ((await db.$count(touhou)) === 0)
    await db.insert(touhou).values([
      { title: "东方红魔乡", category: "game", status: "通关", rating: 9, coverUrl: img("th1") },
      { title: "东方妖々梦", category: "game", status: "收藏", coverUrl: img("th2") },
    ]);

  if ((await db.$count(device)) === 0)
    await db.insert(device).values([
      {
        name: "MacBook Pro 14",
        category: "电脑",
        spec: "M3 Pro / 36G",
        status: "在用",
        acquired: "2024-01",
      },
      {
        name: "iPhone 15 Pro",
        category: "手机",
        spec: "256G 原色钛金属",
        status: "在用",
        acquired: "2023-09",
      },
    ]);

  if ((await db.$count(photo)) === 0) {
    await db
      .insert(album)
      .values({ name: "旅行记录", coverUrl: "https://picsum.photos/seed/umi/800/800" })
      .onConflictDoNothing({ target: album.name });
    const [travel] = await db.select().from(album).where(eq(album.name, "旅行记录"));
    await db.insert(photo).values([
      {
        title: "海边",
        imageUrl: "https://picsum.photos/seed/umi/800/800",
        takenAt: "2024-08",
        albumId: travel!.id,
      },
      {
        title: "樱花",
        imageUrl: "https://picsum.photos/seed/sakura/800/800",
        takenAt: "2024-04",
        albumId: travel!.id,
      },
      {
        title: "街道",
        imageUrl: "https://picsum.photos/seed/machi/800/800",
        takenAt: "2024-06",
        albumId: travel!.id,
      },
    ]);
  }

  if ((await db.$count(moment)) === 0)
    await db.insert(moment).values([
      { content: "把个人空间用 Next 全栈重写了一遍，粉粉的好可爱 (｡･ω･｡)", mood: "开心" },
      { content: "oRPC + Drizzle 真香，端到端类型安全。", mood: "满足" },
    ]);

  if ((await db.$count(friend)) === 0)
    await db.insert(friend).values([
      {
        name: "lemonkoi",
        url: "https://example.com",
        description: "一只写代码的猫",
        group: "朋友",
        status: "active",
      },
      {
        name: "wikimoe",
        url: "https://example.org",
        description: "萌系插画站",
        group: "朋友",
        status: "active",
      },
    ]);

  if ((await db.$count(monitor)) === 0)
    await db.insert(monitor).values([
      { name: "本站", target: "https://i.saop.cc", kind: "http", enabled: true },
      { name: "GitHub", target: "https://github.com", kind: "http", enabled: true },
    ]);

  console.log("✓ seeded sample content across domains");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
