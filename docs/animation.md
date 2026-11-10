# 动效分工

Motion、GSAP、Anime.js 同时使用，各自控制不同的元素层级；不以替换现有动画库为目标。

## 视觉方向

前台改为亚丝娜的月白、绯红、香槟金主题，深色模式使用冷调夜色；后台保留原主题。
首页以人物首屏为主要视觉中心，以 SAO 切角菜单组织博客、音乐、舞萌、视觉小说、东方、相册；原有全部栏目入口仍然保留。
内容区采用收藏、照片编排、文章与碎念，全部使用实际数据；详见 [设计说明](asuna-design.md)。

## Motion：状态与交互

- `components/public/site-header.tsx`：分组导航的活动栏目使用共享高亮；桌面链接、手机底栏、面板链接分别使用 `active-desktop` / `active-bar` / `active-panel`，防止隐藏布局与可见布局争抢同一高亮。`LayoutGroup` 隔离命名，固定导航使用 `layoutRoot`，可滚动导航使用 `layoutScroll`，避免滚动后高亮坐标偏移。
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

## Three.js / p5.js：首屏的独立图形层

- `components/public/aincrad-scene.tsx` 保留服务端 SVG，客户端按动态偏好独立加载两套引擎；不导入后台、内容页或播放器。
- `aincrad-renderer.ts` 使用 Three.js 的 WebGPU / WebGL 2 后端绘制程序化浮空城；只有软件 WebGPU adapter 或设备不可用时直接用 WebGL，没有可用 GPU 时沿用静态 SVG。只修改自己场景内部的物件，不接管 GSAP 的人物包装层。
- `aincrad-dust.ts` 使用 p5.js 实例模式和 Canvas 2D 绘制光尘；不污染全局绘图方法，不增加第二个 GPU 上下文。Vite 沿用 p5 的 `IS_MINIFIED` 生产开关，裁剪诊断翻译的远端 npm CDN 初始化，保留模块化入口；原生浏览器警告和页面异常仍由测试检查。
- 绘制上限为 30fps，限制像素比与粒子数量。用户可暂停和继续；离屏、后台标签页停止绘制；减少动态效果或省流量模式保留静态远景。
- 模块卸载或偏好切换时释放自己的画布、几何、材质、渲染器、p5 实例、观察器与事件。无脚本、引擎下载失败或 GPU 不可用时，正文与导航仍可使用。

## Live2D：仓内独立运行时与资产

`packages/live2d`（`@i/live2d`）管理原有 Cubism 2 封装及所有必需的本地资源，无 npm 运行时依赖。模型目录、42 套 Asuna 换装及其余人物均由本站 `/live2d/` 提供；Vite 适配仅在开发/构建使用，模型不会塞进 JS bundle。React 工具栏与站点偏好仍由应用组件负责，不与 Three.js / p5.js 的场景或包装层争用控制权。

资源初始版本、SHA-256 锁、上游两条失效动作引用的修正及 SDK/模型授权边界见 [包说明](../packages/live2d/README.md)。Core 是原有第三方 bundle，不应称为本站重写的底层 SDK。`e2e/live2d.spec.ts` 在拦截站外请求时验证真实拍照像素、换装、换人、隐藏与重新召唤；包内测试验证资源引用闭合、完整性以及开发/生产静态资源接入。

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
`e2e/grouped-navigation.spec.ts`、`e2e/navigation.spec.ts` 验证全部栏目、深链、键盘与焦点、前进后退、断点切换、正文避让、矮屏滚动和无 JavaScript 导航。
`e2e/navigation-motion.spec.ts` 验证手机与桌面在普通/减少动态效果偏好下连续跨组跳转，高亮唯一且留在实际目标内；原播放器与客户端路由验证改为经分组入口操作，未移除播放持续性断言。

`e2e/graphics-scene.spec.ts` 覆盖浮空城与光尘实际挂载、暂停与继续、离屏停绘、运行中减少动态效果、省流量、无 GPU / 软件 adapter / 设备不可用降级、引擎独立下载失败、上下文丢失事件、客户端往返和手机/桌面键盘操作。

无头机的 `No available adapters.` 与精确匹配的原生 `GPU stall due to ReadPixels` 性能诊断单独保留为 Playwright 附件；其余警告、应用错误和所有未捕获异常仍使测试失败。真实硬件 WebGPU 仍需在支持设备上验收，不能仅凭软件 adapter 的存在或画布出现就算通过。

使用仓库正常的 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`，以及生产构建上的 Playwright 验证。

## 加载边界

GSAP / ScrollTrigger 和兴趣地图由首页路由使用；Anime.js 还承担全站栏目标题绘制。Three.js 与 p5.js 通过首页动态导入分包，服务端不执行浏览器绘图代码；减少动态效果和省流量模式不发起这两套引擎的加载。
这不是零体积改动。是否启用三库已经是明确的产品选择；优化应针对实际导入和重复工作，而不是删掉其中某个库来回避需求。

官方参考：[Motion](https://motion.dev/docs/react-layout-animations)、[GSAP React](https://gsap.com/resources/React/)、[Anime.js React](https://animejs.com/documentation/getting-started/using-with-react)。
