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

/** 颜色词 → 类名。pink 走主题 token,其余用 Tailwind 默认色板。 */
const COLOR: Record<string, string> = {
  pink: "bg-primary text-primary-foreground hover:opacity-90",
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  blue: "bg-sky-500 text-white hover:bg-sky-600",
  green: "bg-emerald-500 text-white hover:bg-emerald-600",
  red: "bg-rose-500 text-white hover:bg-rose-600",
  purple: "bg-violet-500 text-white hover:bg-violet-600",
  yellow: "bg-amber-400 text-neutral-900 hover:bg-amber-500",
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
