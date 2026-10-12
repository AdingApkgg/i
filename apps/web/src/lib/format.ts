/**
 * 站点统一按东八区展示时间。页面在服务端渲染、浏览器里水合：不固定时区的话，
 * 服务器（UTC）和访客浏览器格式化出的文本不同，会触发 React 水合不一致。
 */
export const SITE_TIME_ZONE = "Asia/Shanghai";

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: SITE_TIME_ZONE, ...opts }).format(
    new Date(d),
  );
}
