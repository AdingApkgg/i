import { MotionConfig } from "motion/react";
import { Outlet } from "react-router";
import { MusicPlayer } from "@/components/player/music-player";
import { MascotWidget } from "@/components/public/mascot-widget";

/**
 * 前台最外层：全站播放器和看板娘。
 * 放在会出错的前台布局之外 —— 页面 404 / 出错时由内层布局的错误边界接住，
 * 这一层不会被卸载，正在放的音乐不中断、看板娘不重新加载。
 */
export default function SiteShell() {
  return (
    <MotionConfig reducedMotion="user">
      <Outlet />
      <MusicPlayer />
      <MascotWidget />
    </MotionConfig>
  );
}
