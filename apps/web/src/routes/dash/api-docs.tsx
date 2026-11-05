/**
 * 交互式 API 文档：Scalar 直接读 /api/openapi.json，能在页面里填 token 试打。
 * Scalar 依赖 DOM（内部是 vue），所以只在浏览器挂载后动态引入，SSR 阶段先画骨架。
 */
import { Button } from "@i/ui";
import { BookOpen, LoaderCircle } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { Link } from "react-router";

type ScalarProps = { configuration: Record<string, unknown> };

/**
 * Scalar 自带一套 design system，连 `--background` 这种通用变量都会在 .scalar-app 上重定义，
 * 所以先在容器（不受它影响）把站内 token 抄成 --docs-*，再喂给它的 --scalar-* 槽位。
 */
const customCss = `
  .dash-api-docs {
    --docs-bg: var(--background);
    --docs-bg-soft: var(--muted);
    --docs-card: var(--card);
    --docs-fg: var(--foreground);
    --docs-fg-muted: var(--muted-foreground);
    --docs-border: var(--border);
    --docs-primary: var(--primary);
    --docs-primary-fg: var(--primary-foreground);
    --docs-radius: var(--radius-md);
  }
  .dash-api-docs .scalar-app {
    --scalar-font: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    --scalar-background-1: var(--docs-bg);
    --scalar-background-2: var(--docs-bg-soft);
    --scalar-background-3: var(--docs-card);
    --scalar-color-1: var(--docs-fg);
    --scalar-color-2: var(--docs-fg-muted);
    --scalar-color-3: var(--docs-fg-muted);
    --scalar-color-accent: var(--docs-primary);
    --scalar-border-color: var(--docs-border);
    --scalar-button-1: var(--docs-primary);
    --scalar-button-1-color: var(--docs-primary-fg);
    --scalar-radius: var(--docs-radius);
    --scalar-sidebar-background-1: var(--docs-bg);
    background: var(--docs-bg) !important;
    color: var(--docs-fg) !important;
  }
  .dash-api-docs .scalar-app .scalar-reference a { text-underline-offset: 2px; }
`;

/** 系统偏好是否为深色；SSR 没有 window，先按浅色 */
function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Scalar 的 darkMode 只收布尔值，只能由 JS 从媒体查询翻译过去。
 * 这里不做 mounted 门控：Scalar 本身要等 useEffect 才动态引入，客户端首帧已经没有 SSR 内容，
 * 惰性初始值就能拿到真实偏好，避免「先浅色闪一下再切黑」。
 */
function useDarkScheme() {
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return dark;
}

export default function ApiDocsPage() {
  const [Scalar, setScalar] = useState<ComponentType<ScalarProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [mod] = await Promise.all([
          import("@scalar/api-reference-react"),
          import("@scalar/api-reference-react/style.css"),
        ]);
        if (alive) setScalar(() => mod.ApiReferenceReact as ComponentType<ScalarProps>);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dark = useDarkScheme();

  return (
    <div className="dash-api-docs min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold sm:text-2xl">API 文档</h1>
        <p className="text-sm text-muted-foreground">
          全部管理动作都在这里，可以直接填 token 试打；给 AI 用同一份文档。
        </p>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link to="/dash/tokens">
            <BookOpen className="size-3.5" /> 去签发 token
          </Link>
        </Button>
      </div>

      <div className="mt-4 h-[calc(100dvh-11rem)] min-h-[60vh]">
        {failed ? (
          <p className="text-sm text-muted-foreground">
            文档组件没加载起来，可以直接看{" "}
            <a className="underline" href="/api/openapi.json">
              /api/openapi.json
            </a>
            。
          </p>
        ) : Scalar ? (
          <Scalar
            configuration={{
              url: "/api/openapi.json",
              theme: "none",
              darkMode: dark,
              hideDarkModeToggle: true,
              withDefaultFonts: false,
              layout: "modern",
              hideClientButton: true,
              customCss,
              // 文档里只有 bearer 一种方案：直接选中它，填一次 token 就能试所有接口
              authentication: { preferredSecurityScheme: "bearer" },
            }}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> 正在加载文档…
          </div>
        )}
      </div>
    </div>
  );
}
