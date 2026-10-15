# Video.js 10 音视频与歌词 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面替换 Vidstack，保留悬浮音乐外观，完成歌单和滚动歌词。

**Architecture:** 使用 Video.js 10 React 音频预设与自有悬浮控件，视频使用标准皮肤。Zustand 管理当前队列与偏好，Video.js 管理播放状态；独立歌词解析器和查询组件负责 LRC、加载及跟随。

**Tech Stack:** React 19、@videojs/react 10.1.0、Zustand、TanStack Query、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-16-videojs-design.md`

## Global Constraints

- 不新增数据库迁移，不自动部署到生产。
- 安装、构建、类型检查、测试和浏览器全部在 localhost-1，通过 11090 代理；本机只读改代码与 Git。
- 悬浮音乐维持桌面外观与手机隐藏规则；旧 DPlayer JSON 节点继续兼容。
- 删除 Vidstack 依赖、样式、兼容补丁及 Docker 补丁复制。
- 歌词仅在打开面板时加载；高频播放状态不持久化。

## Review Focus

- 同 URL 重播、切歌期间旧事件和旧歌词请求不得污染新歌。
- CORS 失败重建媒体元素后保持播放意图、静音与音量。
- 歌词加载失败、无时间戳、负 offset、相同时间多语言文本不影响播放。
- SSR 首帧一致；视频点击前不请求媒体，带查询参数 HLS 可解码。
- 队列与歌词面板变高时保持在视口内，键盘控制和手动滚动歌词可用。

### Task 1: 歌词数据契约

**Files:** Create `apps/web/src/lib/lyrics.ts`, `apps/web/src/lib/lyrics.test.ts`.

**Interfaces:**
- Produces `parseLyrics(text: string): { lines: { time: number; text: string }[]; text: string[] }`, `activeLyricIndex(lines, time): number`, `loadLyrics(source: string, signal?: AbortSignal): Promise<ParsedLyrics>`。
- `lines` 按秒排序、相同时间合并文本；`text` 为无时间戳正文；未开始时索引 -1。

- [ ] Step 1: 写测试覆盖多时间标签、1/2/3 位小数、正负 offset、相同时间翻译合并、元信息/空文档/纯文本、跳播前后高亮索引。
- [ ] Step 2: 在 localhost-1 跑 `bunx vitest run src/lib/lyrics.test.ts`，确认因缺少实现失败。
- [ ] Step 3: 实现解析、索引与内联/HTTP(S) 加载，限制远程协议，传递 AbortSignal。
- [ ] Step 4: 相同命令通过。Expected: 全部歌词数据用例通过。
- [ ] Step 5: 提交歌词数据与测试。

### Task 2: 音视频迁移、队列与歌词交互

**Files:** Modify `apps/web/src/components/player/music-player.tsx`, `apps/web/src/components/content/blocks/dplayer.tsx`, `apps/web/src/stores/player.ts`, `apps/web/src/root.tsx`, `apps/web/src/globals.css`, `apps/web/e2e/players.spec.ts`, dependency manifests / lock / Dockerfile; Create `apps/web/src/components/player/lyrics-panel.tsx`; delete obsolete Vidstack patch and translations.

**Interfaces:** Consumes Task 1 parser / loader；组件在 AudioPlayer 上下文用音频预设 `usePlayer` 订阅时间并执行定位。Zustand 增加歌词面板开关，不持久化歌词或时间。

- [ ] Step 1: 扩充浏览器用例：歌单点击后当前项高亮；歌词自动滚动、点击跳转、手动浏览与恢复跟随；慢请求切歌、无歌词/纯文本/失败重试。先在旧版本运行新场景并确认缺失歌词入口导致失败。
- [ ] Step 2: 远程安装 @videojs/react 10.1.0，接入 AudioPlayer / Audio 与标准视频皮肤，保留现有 7 项播放契约。移除全部 Vidstack 生产依赖与兼容文件。
- [ ] Step 3: 实现歌词面板、歌单定位与无障碍属性；动态值由 Video.js 驱动，保留 CORS 可视化降级和跨页播放器实例。
- [ ] Step 4: 远程 `bun run lint && bun run typecheck && bun run test && bun run build`。Expected: 全部通过。
- [ ] Step 5: 启动现有远程开发栈的生产构建，运行完整 `bun run test:e2e`。Expected: 全部通过；截取桌面歌词/歌单、手机视频、真实 Meting 播放证据。
- [ ] Step 6: 独立审查整分支，解决实质问题，提交 PR 并等待 CI。Expected: 完整 CI 通过；说明验证范围及第三方资源限制。
