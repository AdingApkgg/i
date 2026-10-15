# Bangumi 双向追番同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成 token 单账号双向追番同步，首次演练后才能确认写入。

**Architecture:** 固定 Bangumi API 客户端 + 纯三方合并器；独立 Drizzle 收藏/账号/运行记录表；管理员 oRPC 驱动异步预览与应用，公开路由只读已保存的非私有条目。与现有影视内容分离。

**Tech Stack:** React Router 8、React 19、oRPC、Drizzle/Postgres、Zod、Vitest/PGlite、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-16-bangumi-design.md`

## Global Constraints

- 首次演练不写 Bangumi、不改本地收藏/baseline；确认前重新核对账号、本地 revision 和远端内容；预览 30 分钟过期。
- Token 仅服务端 `BANGUMI_ACCESS_TOKEN`；API 固定 `https://api.bgm.tv`；私有收藏绝不通过公开路由输出。
- 状态 type=1/2/3/4/5；评分 0–10；动画进度按 episode ID 操作，不写收藏 ep_status，不依赖 updated_at 增量同步。
- 自动同步默认关闭，每 10 分钟；首次确认成功才可打开。单任务 15 分钟上限，数据库互斥、行锁和 revision 保护。
- Mac 不安装/构建/运行浏览器。所有验证在 localhost-1；不重置现有开发库、不操作 arch、不自动合并。

## Review Focus

- 无 baseline 双边不一致、远端取消收藏、分页失败均不能静默覆盖或重建。
- 同字段冲突与不同集数独立修改；清空短评/评分为合法修改，新增章节默认未看。
- 过期表单/预览、双击确认、账号更换、任务重启和部分远端写入后失败。
- 私有 → 公开是可同步的明确字段变更；私有条目、预览和 token 不得进入公开查询/loader。
- 初次扫描多分页、多章节和限流；响应损坏必须中止，外部错误不得泄露凭据。

### Task 1: API 与合并契约

**Files:** Create `apps/web/src/lib/bangumi/types.ts`, `merge.ts`, `merge.test.ts`, `api.server.ts`, `api.server.test.ts`.

**Interfaces:**
- `CollectionState {type:number;rate:number;comment:string;private:boolean;episodes:Record<string,number>}`。
- `AnimeMetadata {id:number;name:string;nameCn:string;image:string;date:string;eps:number;score:number|null;episodes:EpisodeInfo[]}`。
- `mergeCollection(base:CollectionState|null, local:CollectionState|null, remote:CollectionState|null, choices?:Record<string,'local'|'remote'>): {merged:CollectionState|null;conflicts:string[];push:boolean;pull:boolean;missingRemote:boolean}`。
- `BangumiClient(token, options?)`: `me()`, `snapshot():Promise<RemoteEntry[]>`, `entry(subjectId):Promise<RemoteEntry|null>`, `subject(id):Promise<AnimeMetadata>`, `write(id,current,target):Promise<void>`；注入 fetch 仅构造器用于协议级测试。

- [x] 写独立手算三方合并用例：单边/双边同值/冲突、清零、逐集独立合并、无基线与缺失；远程运行见 RED，再实现见 GREEN。
- [x] 写 API 协议测试：Bearer/固定源、分页/解析失败、401/429/5xx、四种章节状态、只 PATCH 改动字段、不写 tags/ep_status；远程 RED→GREEN。
- [x] 提交 Task 1。

### Task 2: 持久化与可恢复同步服务

**Files:** Modify `packages/db/src/schema.ts`; generate `packages/db/drizzle/0002_*.sql` and meta; Create `apps/web/src/server/bangumi/{repository,service,scheduler}.ts`, `service.test.ts`, `apps/web/src/server/routers/bangumi.ts`; Modify `apps/web/src/server/router.ts`, `apps/web/src/hono.ts`, `.env.example`, compose environment blocks.

**Interfaces:**
- Schema exports `bangumiAccount`, `bangumiEntry`, `bangumiRun`；JSON 字段类型与 Task 1 一致。
- Service consumes `Db` and `BangumiClient`，produces `createPreview(db,client)`, `confirmPreview(db,client,runId,choices)`, `synchronize(db,client)`, `saveEntry(db,id,revision,state)`；异步运行记录通过后台查询轮询。
- Router `bangumi` produces admin `status/list/add/update/preview/run/apply/sync/settings` 与 public `publicList`，公开输出显式投影字段。

- [x] 写 PGlite 集成测试：演练前后收藏表一致且 fake 上游零写；首次禁止普通 sync；确认后 baseline；变更/过期/重复确认拒绝；冲突不写；私有过滤；错账号拒绝；部分失败可重试；并发 revision。远程 RED→GREEN。
- [x] 增量建表与远程 db:generate；对远程开发库做备份后应用新增迁移，验证旧内容计数相同。
- [x] 实现持久化任务、服务/路由/定时器；完成上述测试及权限用例。
- [x] 提交 Task 2。

### Task 3: 番剧前后台与浏览器验收

**Files:** Create `apps/web/src/routes/site/anime.tsx`, `apps/web/src/routes/dash/anime.tsx`, `apps/web/src/components/bangumi/{entry-editor,sync-preview}.tsx`, `apps/web/e2e/bangumi.spec.ts`, `apps/web/test/bangumi-preload.mjs`; Modify routes/nav/sidebar/README。

**Interfaces:** UI consumes router types。后台查询运行记录直到 ready/success/error，演练确认提交 run ID 和逐字段 choices。编辑提交 revision，成功后刷新列表/同步状态；公开只消费 publicList。

- [x] 先写浏览器测试，在旧页面确认失败；测试替身仅测试启动脚本注入 BangumiClient fetch，不加入任意生产 API 配置。
- [x] 完成后台连接状态、导入、逐集编辑、演练差异/冲突选择/确认、立即同步/自动开关和错误/运行进度；前台卡片与状态筛选，空状态可用。
- [x] 远程 frozen install、lint、typecheck、全量 unit、生产 build；远程浏览器验证首次零写/确认/站内推送/远端拉取/冲突/私有不公开，桌面和窄屏截图。
- [x] 独立全分支代码审查；修复实质问题并补 RED→GREEN 证据。
- [ ] 提交 PR 并等待完整 Docker 站点 CI 通过；记录真实 token 是否提供，真实账号只做只读演练。

## 验证记录

- 远程主机 localhost-1（hostname: localhost），Bun 1.4.3：lint、全库类型检查、171 项单测、生产构建全部通过。
- Chromium：2 项 Bangumi 浏览器测试通过（45 秒），覆盖首次零写、双向同步、连续编辑、真实章节 ID、正常冲突、不确定写入恢复、新增条目、私有过滤和窄屏布局。
- 开发库先备份后应用 0002/0003 纯增量迁移；Post72/Page2/Movie3/Photo154/Track5 保持不变。
- 独立审查指出的问题均补回归并修复，复查无剩余阻塞项。
- 真实 token 未提供；上述为协议替身验收，未写入真实 Bangumi 账号、未部署 arch。
