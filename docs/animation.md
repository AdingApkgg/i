# 动效分工

Motion、GSAP、Anime.js 同时使用，各自控制不同的元素层级；不以替换现有动画库为目标。

## 视觉方向

前台改为亚丝娜的月白、绯红、香槟金主题，深色模式使用冷调夜色；后台保留原主题。
首页以人物首屏为主要视觉中心，以 SAO 切角菜单组织博客、音乐、舞萌、视觉小说、东方、相册；原有全部栏目入口仍然保留。
内容区采用收藏、照片编排、文章与碎念，全部使用实际数据；详见 [设计说明](asuna-design.md)。

## Motion：状态与交互

- `components/public/site-header.tsx`：活动栏目通过同一个 `layoutId` 共享高亮；`LayoutGroup` 隔离命名，固定导航使用 `layoutRoot`，横/纵滚动导航使用 `layoutScroll`，避免滚动后高亮坐标偏移。
- `components/public/photo-lightbox.tsx`：上一张/下一张带方向的位移、轻缩放和淡入。切图外层由 Motion 控制，缩放/平移手势继续控制内层，避免两个实现竞争同一个 `transform`。
- 保留已有的页面过渡、卡片入场、音乐播放器展开/收起、歌单与歌词动画，不改媒体播放状态。
- `routes/site/shell.tsx` 使用 `MotionConfig reducedMotion="user"`，统一关闭减少动态效果模式下的变换与布局动画。

## GSAP：首页演出与滚动编排

`components/public/home-scene.tsx`：

- 标题、身份信息、人物静帧和行动入口按时间轴编排。
- 首屏斜切背景随滚动产生轻微视差；各内容章节的线条随进入视口的进度展开。
- 只控制自己的包装层、背景、章节线条，不接管 Motion 卡片或 Anime.js 的 SVG / 节点内层。
- `useGSAP()` + 局部 `gsap.matchMedia()` 管理上下文；退出首页时清理自己的时间轴、ScrollTrigger 和媒体监听。
- 不拦截原生滚动、不强制平滑滚动、不固定内容屏幕。

## Anime.js：SVG 和图形交互

- `components/public/interest-map.tsx`：切角菜单 SVG 边框绘制和图标交错响应，悬停或键盘聚焦会重播对应项。六个菜单项各自复用一条时间线，不在每次交互时新建实例。
- `components/public/title-flourish.tsx`：各栏目的细剑式标题刻线绘制。
- 使用 `createScope()` 限定选择器，组件卸载时 `revert()`；媒体查询改变时重新应用减少动态效果偏好。
- 地图节点是真实的 React Router 链接，不把导航绑死在动画回调里。

## 首屏与无障碍

服务端 HTML 输出可见正文、静态人物图片和完整 SVG，不依赖动画脚本来显示首屏或使用链接。
保留现有 `useSkipInitial()`，不把入场隐藏状态写入首屏正文。
GSAP / Anime.js 遇到 `prefers-reduced-motion: reduce` 时保留静态完整画面，运行中切换偏好也会清理旧效果。
装饰 SVG 不进入辅助技术树；地图链接有名称、键盘焦点与点击区域。

## 验证

新增 `e2e/animation.spec.ts` 覆盖：

- 手机/桌面导航高亮的真实几何位置。
- 地图 SVG 绘制、键盘触发与客户端跳转。
- 首页滚动章节线条、离开并返回首页。
- 减少动态效果及运行中切换偏好。
- JavaScript 禁用时的正文和链接。
- 标题签名、灯箱切图/缩放/焦点归还。
- 320 / 390 / 1024 / 1440px 首页布局。

`e2e/asuna-home.spec.ts` 额外覆盖首屏行动、照片与文章内容、320 / 390 / 768 / 1024 / 1440 / 1920px 布局、窄屏插画与行动入口不重叠、深色切换与后台主题隔离。
`lib/og.test.ts` 通过 PNG 真实像素验证分享卡片的月白背景与绯红边框。

使用仓库正常的 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`，以及生产构建上的 Playwright 验证。

## 加载边界

GSAP / ScrollTrigger 和兴趣地图由首页路由使用；Anime.js 还承担全站栏目标题绘制。
这不是零体积改动。是否启用三库已经是明确的产品选择；优化应针对实际导入和重复工作，而不是删掉其中某个库来回避需求。

官方参考：[Motion](https://motion.dev/docs/react-layout-animations)、[GSAP React](https://gsap.com/resources/React/)、[Anime.js React](https://animejs.com/documentation/getting-started/using-with-react)。
