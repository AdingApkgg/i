import { cn } from "@i/ui";
import { useNavigation } from "react-router";

/**
 * 路由切换时顶部的细进度条。等 loader 数据和路由代码的那段时间给个反馈，
 * 否则点击后页面毫无变化，看起来像卡住了。150ms 内完成的导航不显示，避免闪一下。
 * 动画只用 transform / opacity（样式见 globals.css 的 .nav-progress）。
 */
export function NavProgress() {
  const busy = useNavigation().state !== "idle";
  return <div aria-hidden className={cn("nav-progress", busy && "is-busy")} />;
}
