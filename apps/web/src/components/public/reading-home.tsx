import { siteConfig } from "@i/config";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { formatDate } from "@/lib/format";
import {
  type HomeContent,
  type HomeResult,
  type HomeState,
  previewPosts,
  previewShort,
} from "@/lib/home-content";
import { createHomeRetry } from "@/lib/home-retry";
import { client } from "@/lib/orpc/client";
import "./reading-home.css";
import { ScenePerformance } from "./scene-performance";

const readPosts = async (signal: AbortSignal) =>
  previewPosts(await client.blog.list(undefined, { signal }));
const readMoments = async (signal: AbortSignal) =>
  previewShort(await client.moments.list(undefined, { signal }));
const readProjects = async (signal: AbortSignal) =>
  previewShort(await client.project.list(undefined, { signal }));
const displayDate = (value: Date | string) =>
  formatDate(value, { year: "numeric", month: "2-digit", day: "2-digit" });

function ContentDate({ value }: { value: Date | string }) {
  return <time dateTime={new Date(value).toISOString()}>{displayDate(value)}</time>;
}

type Control<T> = {
  state: HomeState<T>;
  visible: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  retry: () => void;
};

function useHomeSection<T>(
  initial: HomeResult<T>,
  read: (signal: AbortSignal) => Promise<T[]>,
): Control<T> {
  const [state, setState] = useState<HomeState<T>>(initial);
  const [retried, setRetried] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useMemo(
    () => createHomeRetry(read, setState, () => heading.current?.focus({ preventScroll: true })),
    [read],
  );
  useEffect(() => {
    setState(initial);
    setRetried(false);
    return () => request.cancel();
  }, [initial, request]);
  return {
    state,
    visible: state.status !== "ready" || state.items.length > 0 || retried,
    heading,
    retry: () => {
      setRetried(true);
      void request.run();
    },
  };
}

/** SSR 首屏与浏览器重试共用真实内容；不挂载旧城体、光尘或演示快照。 */
export function ReadingHome({ content }: { content: HomeContent }) {
  const posts = useHomeSection(content.posts, readPosts);
  const moments = useHomeSection(content.moments, readMoments);
  const projects = useHomeSection(content.projects, readProjects);
  const [intro, ...description] = siteConfig.tagline.split(" · ");
  const descriptionText = description.join(" · ");
  const lastWord = descriptionText.lastIndexOf(" ") + 1;
  return (
    <div className="reading-home" id="top">
      <div className="reading-stage">
        <ScenePerformance />
        <div className="reading-identity">
          <p className="reading-handle">{siteConfig.handle}</p>
          <h1>{siteConfig.title}</h1>
          <p className="reading-intro">{intro}</p>
          <p className="reading-description">
            {descriptionText.slice(0, lastWord)}
            <span className="reading-description-tail">{descriptionText.slice(lastWord)}</span>
          </p>
          <div className="reading-actions">
            <Link className="reading-action-primary" to={posts.visible ? "#journal" : "/blog"}>
              读文章
            </Link>
            <Link to={projects.visible ? "#projects" : "/projects"}>看作品</Link>
          </div>
        </div>
        <figure className="reading-portrait">
          <img
            src="/images/asuna-aincrad.webp"
            alt="亚丝娜 · 站内静帧"
            width="821"
            height="2000"
            fetchPriority="high"
            decoding="async"
          />
          <figcaption>亚丝娜 · 站内静帧</figcaption>
        </figure>
        <HomeSection
          id="journal"
          kind="posts"
          title="最近文章"
          noun="文章"
          href="/blog"
          more="全部文章"
          control={posts}
          journal
        >
          {posts.state.items.map((post) => (
            <article key={post.id} data-post-preview>
              <ContentDate value={post.publishedAt ?? post.createdAt} />
              <h3>
                <Link to={`/blog/${encodeURIComponent(post.slug)}`}>{post.title}</Link>
              </h3>
              {post.excerpt && <p className="reading-excerpt">{post.excerpt}</p>}
            </article>
          ))}
        </HomeSection>
        {!posts.visible && !moments.visible && !projects.visible && (
          <p className="reading-no-content">暂无可展示的公开内容，可以从栏目浏览。</p>
        )}
      </div>
      {(moments.visible || projects.visible) && (
        <div className="reading-lower">
          <HomeSection
            id="moments"
            kind="moments"
            title="最近说说"
            noun="说说"
            href="/moments"
            more="全部说说"
            control={moments}
          >
            {moments.state.items.map((moment) => (
              <article key={moment.id} data-moment-preview className="reading-moment">
                <p>{moment.content}</p>
                <ContentDate value={moment.createdAt} />
              </article>
            ))}
          </HomeSection>
          <HomeSection
            id="projects"
            kind="projects"
            title="作品"
            noun="作品"
            href="/projects"
            more="全部作品"
            control={projects}
          >
            {projects.state.items.map((project) => (
              <article key={project.id} data-project-preview className="reading-project">
                <h3>
                  <Link to="/projects">{project.name}</Link>
                </h3>
                {project.description && <p>{project.description}</p>}
                {project.tag && <span>{project.tag}</span>}
              </article>
            ))}
          </HomeSection>
        </div>
      )}
      <footer className="reading-footer">
        <p>
          {siteConfig.title} 的个人空间
          <br />
          <span>SAO 视觉致意 · 非官方网站</span>
        </p>
        <Link to="/gallery">相册</Link>
        <Link to="/music">音乐收藏</Link>
        <Link to="/friends">友链</Link>
        <Link to="/about">关于</Link>
        <a href="#top">回到顶部</a>
      </footer>
    </div>
  );
}

function HomeSection<T>({
  id,
  kind,
  title,
  noun,
  href,
  more,
  control,
  children,
  journal = false,
}: {
  id: string;
  kind: string;
  title: string;
  noun: string;
  href: string;
  more: string;
  control: Control<T>;
  children: ReactNode;
  journal?: boolean;
}) {
  if (!control.visible) return null;
  const { status, items } = control.state;
  return (
    <section
      id={id}
      className={journal ? "reading-journal" : "reading-section"}
      data-content-section={kind}
      data-state={status}
      aria-busy={status === "loading"}
      aria-labelledby={`${id}-title`}
    >
      <div className="reading-section-heading">
        <h2 id={`${id}-title`} ref={control.heading} tabIndex={-1}>
          {title}
        </h2>
        <Link to={href}>{more}</Link>
      </div>
      {status === "error" ? (
        <div className="reading-content-state" role="alert">
          <span className="reading-state-symbol" aria-hidden="true">
            !
          </span>
          <h3>{noun}暂时未能读取</h3>
          <p>其他已显示的内容仍可继续阅读。可以重试，或通过栏目浏览。</p>
          <button type="button" className="reading-retry" onClick={control.retry}>
            重试
          </button>
          <noscript>
            <style>{".reading-retry { display:none; }"}</style>
            <p>当前未启用脚本，可以刷新页面，或使用上方的栏目链接。</p>
          </noscript>
        </div>
      ) : status === "loading" ? (
        <div className="reading-content-state" role="status" aria-live="polite">
          <h3>正在读取{noun}</h3>
          <p>仅更新这一部分，其他内容不受影响。</p>
          <div className="reading-skeleton" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="reading-state-empty" role="status">
          暂时还没有公开{noun}。
        </p>
      ) : (
        children
      )}
    </section>
  );
}
