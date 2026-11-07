import { cn } from "@i/ui";
import { ArrowUpRight } from "lucide-react";
import { faIcon } from "./fa-icon";

type BtnProps = {
  url: string;
  text: string;
  /** 原 Hexo 主题的 FontAwesome 类名，映射到 lucide。 */
  icon?: string;
  /** 空格分隔的修饰词:颜色(pink/blue/…)与布局(block)。 */
  variant?: string;
};

/** 颜色词 → 类名。历史 pink 保留为主色别名，实际跟随前台主题。 */
const COLOR: Record<string, string> = {
  pink: "bg-primary text-primary-foreground hover:opacity-90",
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  blue: "bg-info text-white hover:bg-info-strong",
  green: "bg-success text-white hover:bg-success-strong",
  red: "bg-action-danger text-white hover:bg-action-danger-hover",
  purple: "bg-action-special text-white hover:bg-action-special-hover",
  yellow: "bg-warning-bright text-action-on-bright hover:bg-warning",
  gray: "bg-soft text-accent-foreground hover:brightness-95",
};

export function Btn({ url, text, icon, variant = "" }: BtnProps) {
  const words = variant.toLowerCase().split(/\s+/).filter(Boolean);
  const block = words.includes("block");
  const colorWord = words.find((w) => w in COLOR);
  const colorClass = colorWord
    ? COLOR[colorWord]
    : "bg-soft text-accent-foreground hover:brightness-95";

  const external = /^https?:\/\//.test(url);
  const Icon = faIcon(icon);

  return (
    <a
      href={url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium no-underline transition",
        colorClass,
        block && "flex w-full justify-center",
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      <span>{text}</span>
      {external && <ArrowUpRight aria-hidden className="size-3.5" />}
    </a>
  );
}
