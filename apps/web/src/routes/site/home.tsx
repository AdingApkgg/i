import { siteConfig } from "@i/config";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Disc3,
  Headphones,
  Heart,
  Sword,
} from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Stagger, StaggerItem } from "@/components/motion";
import { HomeHero, HomeScene } from "@/components/public/home-scene";
import { InterestMap } from "@/components/public/interest-map";
import { adxChartUrl } from "@/lib/adx";
import { degradeTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumb, thumbProps } from "@/lib/thumb";
import type { Route } from "./+types/home";

function fmtDate(d: Date | string) {
  return formatDate(d, { month: "long", day: "numeric" });
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const [posts, music, movie, vn, moments, photos, mmProfile, mmB50] = await Promise.all([
    api.blog.list().catch(degradeTo([])),
    api.music.list().catch(degradeTo([])),
    api.movie.list().catch(degradeTo([])),
    api.vn.list().catch(degradeTo([])),
    api.moments.list().catch(degradeTo([])),
    api.gallery
      .page({ limit: 6 })
      .then((r) => r.items)
      .catch(degradeTo([])),
    api.maimai.profile().catch(degradeTo(null)),
    api.maimai.b50().catch(degradeTo({ b35: [], b15: [] })),
  ]);
  return {
    posts: posts.slice(0, 3),
    music: music.slice(0, 1),
    movie: movie.slice(0, 1),
    vn: vn.slice(0, 1),
    moments: moments.slice(0, 4),
    photos,
    mmProfile,
    mmB50,
  };
}

export const meta: Route.MetaFunction = (args) => seo(args, { path: "/" });

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts, music, movie, vn, moments, photos, mmProfile, mmB50 } = loaderData;
  const mmTop = [...mmB50.b35, ...mmB50.b15].sort((a, b) => b.ra - a.ra).slice(0, 6);
  return (
    <HomeScene>
      <HomeHero />
      <Section
        id="world"
        title="选择一个世界"
        subtitle="喜欢的事，都有它的位置。"
        moreHref="/friends"
        moreLabel="遇见朋友"
      >
        <InterestMap />
      </Section>

      <Section
        id="life"
        title="最近沉浸的事"
        subtitle="冒险之外，也想好好过每一天。"
        moreHref="/music"
        moreLabel="去音乐库"
      >
        <Stagger className="sao-now-grid">
          <TrackTile
            label="在听"
            icon={<Headphones size={12} />}
            title={music[0]?.title}
            subtitle={music[0]?.artist}
            cover={music[0]?.coverUrl}
            href={music[0]?.link || "/music"}
          />
          <TrackTile
            label="在看"
            icon={<Heart size={12} />}
            title={movie[0]?.title}
            subtitle={movie[0]?.category}
            cover={movie[0]?.coverUrl}
            href={movie[0]?.link || "/movie"}
          />
          <TrackTile
            label="在玩"
            icon={<Sword size={12} />}
            title={vn[0]?.title}
            subtitle={vn[0]?.brand}
            cover={vn[0]?.coverUrl}
            href={vn[0]?.link || "/vn"}
          />
        </Stagger>
      </Section>

      {mmProfile && mmTop.length > 0 && (
        <Section
          title={`舞萌 DX · Rating ${mmProfile.rating}`}
          subtitle="把每一次进步留在谱面上。"
          moreHref="/maimai"
          moreLabel="全部成绩"
        >
          <Stagger className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {mmTop.map((record) => (
              <StaggerItem key={record.id} hover>
                <a
                  href={adxChartUrl(record.songId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden border border-border bg-card"
                >
                  <div className="relative aspect-square bg-muted">
                    {record.coverUrl && (
                      <img
                        src={record.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 left-1 inline-flex items-center bg-card px-1.5 py-0.5 text-xs font-semibold">
                      <ArrowUp className="size-3" />
                      {record.ra}
                    </span>
                  </div>
                  <div className="p-2 text-center text-xs font-semibold text-primary">
                    {record.achievements.toFixed(2)}%
                  </div>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      <Section
        title="把日常存档"
        subtitle="有些瞬间，比通关画面更值得保存。"
        moreHref="/gallery"
        moreLabel="翻开相册"
      >
        {photos.length === 0 ? (
          <Empty>这里还没有照片，下一段风景慢慢收集。</Empty>
        ) : (
          <div className="sao-memory-film">
            {photos.slice(0, 5).map((photo) => (
              <motion.figure
                key={photo.id}
                className="sao-memory"
                whileHover={{ y: -3 }}
                transition={{ duration: 0.25 }}
              >
                <Link
                  prefetch="intent"
                  to="/gallery"
                  aria-label={`查看相册：${photo.title || "照片"}`}
                  className="block h-full"
                >
                  <motion.img
                    {...thumbProps(
                      photo.thumbUrl || photo.imageUrl,
                      [320, 640, 960],
                      "(min-width: 1024px) 600px, 90vw",
                    )}
                    alt={photo.title || "照片"}
                    loading="lazy"
                    whileHover={{ scale: 1.04 }}
                    transition={{ duration: 0.5 }}
                  />
                </Link>
                {photo.title && <figcaption>{photo.title}</figcaption>}
              </motion.figure>
            ))}
          </div>
        )}
      </Section>

      <div className="sao-lower-grid">
        <Section
          id="journal"
          title="写给自己的存档"
          subtitle="在文字里，留下一点真实的自己。"
          moreHref="/blog"
          moreLabel="全部文章"
        >
          {posts.length === 0 ? (
            <Empty>还没有文章。故事可以从今天开始。</Empty>
          ) : (
            <div className="sao-journal-list">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  prefetch="intent"
                  to={`/blog/${post.slug}`}
                  className="sao-journal-entry"
                >
                  <div>
                    <time dateTime={new Date(post.publishedAt ?? post.createdAt).toISOString()}>
                      {fmtDate(post.publishedAt ?? post.createdAt)}
                    </time>
                    <h3>{post.title}</h3>
                    {post.excerpt && <p>{post.excerpt}</p>}
                  </div>
                  <ArrowUpRight size={18} strokeWidth={1.3} />
                </Link>
              ))}
            </div>
          )}
        </Section>
        <aside>
          <Section
            title="此刻的碎念"
            subtitle="不一定重要，但都是生活。"
            moreHref="/moments"
            moreLabel="全部"
          >
            {moments.length === 0 ? (
              <Empty>暂时没有新碎念。</Empty>
            ) : (
              <div className="sao-moments">
                {moments.map((moment) => (
                  <div key={moment.id} className="sao-moment">
                    <p>{moment.content}</p>
                    <footer>
                      {moment.mood && <span>{moment.mood}</span>}
                      <time dateTime={new Date(moment.createdAt).toISOString()}>
                        {fmtDate(moment.createdAt)}
                      </time>
                    </footer>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <div className="sao-profile">
            <Sword size={42} strokeWidth={1} className="text-primary" />
            <div>
              <h3>
                {siteConfig.title}{" "}
                <span className="font-normal text-muted-foreground">／ 关于这里</span>
              </h3>
              <p>{siteConfig.tagline}</p>
              <div className="sao-profile-links">
                <a href={siteConfig.socials.github} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                <a href={siteConfig.socials.email}>邮件</a>
                <a href={siteConfig.socials.rss}>RSS</a>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <footer className="sao-footer">
        <span>
          Asuna 的后花园。以白与绯红，珍藏日常。
          <br />
          SAO 视觉致意 · 站内角色资源 · 非官方网站
        </span>
        <a href="#top">
          回到顶部
          <ArrowUp size={12} />
        </a>
      </footer>
    </HomeScene>
  );
}

function Section({
  title,
  subtitle,
  children,
  moreHref,
  moreLabel = "全部",
  id,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  moreHref?: string;
  moreLabel?: string;
  id?: string;
}) {
  return (
    <section id={id} data-home-section className={id === "world" ? "sao-world" : "sao-section"}>
      <div className="sao-section-heading">
        <span data-section-rule aria-hidden="true" className="sao-section-rule" />
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {moreHref && (
          <Link prefetch="intent" to={moreHref}>
            {moreLabel}
            <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="sao-empty">{children}</p>;
}

function TrackTile({
  label,
  icon,
  title,
  subtitle,
  cover,
  href,
}: {
  label: string;
  icon: ReactNode;
  title?: string | null;
  subtitle?: string | null;
  cover?: string | null;
  href: string;
}) {
  const body = (
    <>
      <div className="sao-now-cover">
        <div className="sao-now-status">
          {icon}
          {label}
        </div>
        {cover ? (
          <motion.img
            src={thumb(cover, 640)}
            alt=""
            loading="lazy"
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.5 }}
          />
        ) : (
          <span>
            {label === "在听" ? (
              <Disc3 size={42} strokeWidth={1} />
            ) : label === "在玩" ? (
              <Sword size={42} strokeWidth={1} />
            ) : (
              <Camera size={42} strokeWidth={1} />
            )}
          </span>
        )}
      </div>
      <div className="sao-now-caption">
        <h3>{title ?? "等待下一次心动"}</h3>
        <p>{subtitle || "慢慢发现，慢慢收藏。"}</p>
      </div>
    </>
  );
  return (
    <StaggerItem hover className="sao-now-item">
      {href.startsWith("/") ? (
        <Link prefetch="intent" to={href}>
          {body}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      )}
    </StaggerItem>
  );
}
