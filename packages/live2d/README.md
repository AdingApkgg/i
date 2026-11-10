# @i/live2d

仓内独立管理的 Cubism 2 看板娘包。浏览器运行时没有 npm 运行时依赖，不使用 Pixi、第三方 Live2D loader 或远程 npm/CDN；Vite、Vitest 和 TypeScript 只用于开发、构建与验证。

## 职责和接入

- `src/cubism2.ts`：从原应用迁入的渲染封装，管理模型、贴图、动作、物理、注视、点击、拍照与实例清理。每个画布使用独立 Core 槽位，销毁时清理自己的遮罩附件与静态缓存，避免重挂或多个画布跨上下文复用纹理。热切换时只有贴图与物理全部就绪才向绘制循环发布新模型，避免慢加载时采样空纹理；不是对专有 Cubism Core 的重写。
- `src/waifu.ts`：模型目录、提示语与问候逻辑。必需资源统一走本站 `/live2d/`。
- `assets/`：Core、86 套模型（11 组，其中 Asuna 42 套）、动作、贴图、表情、提示语和彩蛋脚本。
- `src/vite.mjs`：开发时提供同源静态资源；生产构建时将资源复制到客户端输出目录的 `live2d/`。不运行下载或安装脚本，SSR 不重复复制，也不把模型塞进 JavaScript bundle。
- 应用里的 `live2d-mascot.tsx` 保留 React 工具栏、页面事件和 Zustand 偏好适配；只有它负责本站 UI，本包不依赖 React 或应用的路径别名。

应用通过 `"@i/live2d": "workspace:*"` 引用浏览器 API：

```ts
import { Cubism2Mascot, modelSrc } from "@i/live2d";

const mascot = new Cubism2Mascot(canvas);
await mascot.load(modelSrc("asuna/asuna_01"));
// 离开组件时 mascot.destroy()
```

Vite 配置通过独立的 Node 入口接入，不会把 Node/Vite 带进浏览器运行时：

```ts
import { live2dAssets } from "@i/live2d/vite";
// plugins: [live2dAssets(), ...]
```

必须沿用根路径 `/live2d/`。非 Vite 消费者可以将本包 `assets/` 原样复制到站点静态目录的 `live2d/`。站点的一言功能仍可选地调用 `v1.hitokoto.cn`；它不是模型或渲染依赖，断网不会影响绘制。

## 来源、体积与授权边界

初始模型快照固定为 `weblive2d@1.0.12`，对应上游 `AdingApkgg/live2d-api` 的 revision `47cc77140c828feab20f4fa66966ba2ea8ba85c9`。这是从原先使用的分发渠道一次性导入的数据，不是 package.json 的依赖。初始压缩包已按发布元数据验证 SHA-512；每个本地文件的 SHA-256、来源及补丁记录在 `asset-lock.json`。后续开发、构建、测试和运行不会请求该压缩包或 registry。

Core、本站提示语与打飞机脚本从原仓库原样迁入。原有 Asuna 01 的文件与固定版本逐字节一致。目录组与换装次序保持不变，兼容 `i.mascot` 及旧版 `waifu.*` 偏好。唯一模型配置补丁是移除两个 DSR50 destroy 换装中上游本就缺失的 `motions/wait_1.mtn` 引用；不伪造动作，不删模型或其他可用动作。

资源约 **146 MB（139 MiB）**，是仓库与构建镜像的体积成本，不是首次访问就下载全部；浏览器仍按当前选择加载模型，动作按需请求并缓存。不要为减小仓库而偷偷恢复 CDN 或删掉已支持的换装。

上游 MIT 原文随资源一起分发于 `assets/licenses/live2d-api.LICENSE.txt`，但仓库的 MIT 声明不能视为所有第三方模型、美术和 SDK 的统一授权。原有 `core/live2d.min.js` 未记录确切 SDK/bundle 的发行来源及完整授权文件，仍需补充核实。**本轮只是迁移维护边界，没有完成 SDK/模型的商业授权或公开再分发合规审查。** 详见随产物提供的 `assets/NOTICE.txt`；看板娘「关于」打开这份本地说明。

## 资源维护

1. 先核实新增或替换资源的授权，保留说明；仅使用仓内相对资源路径，不使用远端地址或符号链接。
2. 将资源放入 `assets/model/<模型>/`，更新 `model_list.json`。已有组和换装不要调序；持久化偏好采用数字索引，调整顺序需要显式迁移方案。
3. 人工审查资源、配置与来源变化后，更新 `asset-lock.json` 的来源/补丁说明，再执行 `bun --filter @i/live2d lock:assets` 更新文件校验锁。
4. 执行 `bun --filter @i/live2d test` 与 `bun --filter @i/live2d typecheck`。完整性测试检查每套模型的模型文件、贴图、动作、表情、物理和姿态引用，拒绝缺失文件、站外引用与越界路径；另检查完整文件集合及 SHA-256。
5. 构建应用并执行 `apps/web/e2e/live2d.spec.ts`，确认断开站外请求仍能绘制、换装、换人、拍照、隐藏和召唤。

锁更新命令不是验证命令，不应在每次 CI 验收前自动运行来掩盖意外变更。根目录的 `bun run test`、`bun run typecheck` 已通过 workspace/Turbo 包含本包；Docker 的生产依赖阶段也包含其 workspace manifest。
