# 设计系统维护

设计模型采用「三层 token × 四层构件」；首页的视觉方向见 [Asuna / Aincrad 设计](asuna-design.md)，
模式构件的调用约定见 [patterns](../packages/ui/src/patterns/README.md)。

## 入口与当前覆盖

打开站内 `/design`（线上为 <https://i.saop.cc/design>）查看设计系统活文档。
页面源文件是 `apps/web/src/routes/site/design.tsx`，随公开前台一起渲染，不是受管理员认证保护的后台页面。
示例中的计数和状态仅用于展示构件，不是线上业务指标。

目前展示：

- 六个语义色：`primary`、`info`、`success`、`warning`、`danger`、`neutral`。
- 四档字号：`micro` 10px、`caption` 11px、`code` 13px、`body` 15px；刻度不附带默认行高。
- 六个模式构件：`PageHeader`、`SectionHeader`、`StatusBadge`、`EmptyState`、`Toolbar`、`StatTile`。
- `Button` 的 `default`、`soft`、`outline`、`ghost`、`destructive` 变体：可交互、原生禁用和加载示例。
- 「试用」按钮的真实 hover、active、focus-visible：悬停、按住鼠标或使用 Tab 查看，点击或按 Enter 更新本地计数。
- 本地反馈演示：就绪 → 加载 → 错误 / 完成，错误时可重试；不发送业务请求，也不保存数据。

交互示例位于 `apps/web/src/components/public/design-states.tsx`。共享 `Button` 没有专门的 `loading` 或
`error` 属性：加载示例组合原生 `disabled`、`aria-busy` 与装饰性图标，错误反馈使用 `role="alert"`，
普通状态使用 `role="status"`。加载图标尊重系统的减少动态效果设置；水合前交互控件保持禁用。
错误不是新增的按钮变体，Card 等静态容器也不附加按钮交互态。

明暗主题跟随系统的 `prefers-color-scheme`，页面没有独立主题开关。
当前矩阵覆盖这些按钮及本地反馈组合，不代表输入表单、业务页面、所有模式构件及其状态都有视觉基线；
不能把本页通过等同于全站视觉或可访问性验收。

## 分层与改动位置

四层构件依次是 token、基层构件、模式构件、页面；reset 与可访问性基线作为底座。
页面负责数据和布局，重复的组合下沉到模式层，通用交互留在基层构件。

Token 的依赖方向是原始值 → 语义角色 → 必要的组件契约。当前文件组织为：

- `packages/ui/src/tokens/primitive.css`：原始调色板与常量。
- `packages/ui/src/tokens/scale.css`：补充 Tailwind 缺少的通用刻度，不重复建立已有刻度。
- `packages/ui/src/tokens/theme-moe.css`、`theme-sao.css`：明暗主题的语义映射。
- `packages/ui/src/tokens/index.css`：统一入口；由 `apps/web/src/globals.css` 引入并映射工具类。
- `packages/ui/src/components/`：基层构件；`packages/ui/src/patterns/`：跨页面组合。

文件数量不等于 token 层数；只有构件确实存在专属语义时才增加组件契约，不为凑层级制造变量。
主题映射引用原始变量，不再写色值字面量；两个主题保留一致的通用语义变量集，SAO 扩展使用 `--sao-*`。
SAO 覆盖限定于 `:root:has(.sao-site)`，不要泄漏到后台。

调用页使用语义工具类和构件变体，不直接拼调色板类名。`StatusBadge` 的颜色走 `tone`；
`EmptyState` 已在 `Card` 内时使用 `variant="bare"`，避免嵌套卡片。

## 护栏与验证

在安装了锁文件依赖的构建机上，从仓库根目录执行：

```bash
bun run lint:design
```

`scripts/design-lint.mjs` 检查主题分层契约，并将任意值工具类、原生调色板类、色值字面量、
旧式 CSS 类的数量与 `scripts/design-baseline.json` 比较，只允许不增加。
计数扫描范围目前是 `apps/web/src`，不包含 `packages/ui/src`；共享包仍需代码审查和浏览器验证，
不要把 lint 通过当作共享构件没有违规的证明。

清理旧实现后可用 `node scripts/design-lint.mjs --update` 收紧基线，再审查 JSON 差异并重新执行检查。
不要用这个参数掩盖新增违规：它会先写文件，即使随后检查失败，也可能已改动基线。

浏览器验证使用三个 spec：

- `apps/web/e2e/design-page.spec.ts`：六个模式构件的 DOM、语义主色的明暗差异、桌面与移动端不横向溢出，
  以及桌面、390×844 移动端和暗色三张整页截图。
- `apps/web/e2e/design-tokens.spec.ts`：前台与登录页在明暗主题下的计算样式，包括字号及继承行高、
  热力图颜色和格子尺寸、兼容的状态颜色。
- `apps/web/e2e/design-states.spec.ts`：五种按钮变体在明暗主题下的真实悬停、按住和键盘焦点，
  原生禁用与加载、键盘跳过不可用按钮、本地错误 / 重试 / 完成、减少动态效果；
  另检查 390×844 下不横向溢出，以及滚到底后重试按钮未被固定底栏遮挡。
  请求断言观察同源 `/api/` 与所有非 GET 请求，不把播放器和看板娘各自的资源读取当成反馈演示请求。

先按 [README 的测试说明](../README.md#测试) 准备**隔离测试栈**，完成迁移和 seed，并安装锁文件对应的 Chromium。
即使只跑 `/design`，Playwright 的全局 setup 也会创建或登录测试账号，并在数据库中将其提权为站长；
**绝不能把 `E2E_BASE_URL` 或 `DATABASE_URL` 指向生产环境**。

```bash
# 在构建机的仓库根目录运行；URL 与数据库连接替换为自己的隔离测试栈
cd apps/web
export E2E_BASE_URL=http://localhost:8099
export DATABASE_URL=postgres://i:i@localhost:5432/i
bun run test:e2e e2e/design-page.spec.ts e2e/design-tokens.spec.ts e2e/design-states.spec.ts
```

不设置 `E2E_BASE_URL` 时，Playwright 会启动已有的生产构建，需要先构建并准备依赖服务；
它不会自动替你创建数据库、运行迁移或 seed。使用生产构建而非 Vite 开发服务录制基线，
避免开发模式警告、依赖预构建重载和 HMR 影响结果。完整 CI 还会运行全量 e2e，而不只是这三个 spec。

## 视觉基线维护

整页的三张基线位于 `apps/web/e2e/design-page.spec.ts-snapshots/`，保持最多 2% 的差异像素比例。
交互的 36 张局部基线位于 `apps/web/e2e/design-states.spec.ts-snapshots/`，允许最多 0.5% 的差异像素比例：
五种变体 × 两个主题 × 三种真实交互态，加上明暗加载 / 错误反馈和手机矩阵 / 错误反馈。
局部截图也包含原生禁用和加载按钮。两组均为 Chromium / Linux 产物，禁用动画并隐藏光标；
阈值不是视觉验收的替代品，成功反馈目前有行为断言，但没有单独的局部截图基线。

只有确认是预期视觉变化后，才在与 CI 一致的 Linux / Chromium 环境更新：

```bash
# 沿用上面的隔离测试环境变量，在 apps/web 下运行
bun run test:e2e e2e/design-page.spec.ts e2e/design-states.spec.ts --update-snapshots
# 不带更新参数再跑一次，确认新基线能通过
bun run test:e2e e2e/design-page.spec.ts e2e/design-tokens.spec.ts e2e/design-states.spec.ts
```

检查桌面、手机和暗色截图，将新旧差异与组件改动一起审查；不要只为让 CI 变绿而整体重录基线或放宽阈值。
基线更新不代表允许合并或部署。修改共享构件时还需复核实际调用页；若要求零视觉变化，
应在同环境、同视口下对照改前与改后，并控制字体、图片加载和随机动画造成的噪声。
