# patterns

四层构件里的第三层：**模式层**。把跨页面重复出现的组合（页头、区块头、状态徽章、空态、工具条、统计格）定成一处，
调用页只传内容，不重写间距、字号和语义色。

站内 `/design` 提供构件预览；分层位置、测试范围与基线更新方法见[设计系统维护](../../../../docs/design-system.md)。

约定：

- 只用 `tokens/` 的语义变量与刻度类，不写调色板类名，不写任意值；护栏的实际扫描范围见维护文档。
- 结构（间距、对齐、换行策略）固定在组件里；变体只暴露真正需要分叉的维度（`tone` / `size` / `variant`）。
- 需要一次性微调时用 `className` 覆盖，覆盖失败说明这个维度该进变体。
- 六个语义色 tone 只能映射语义 token：`primary` / `info` / `success` / `warning` / `danger` / `neutral`。

现有构件：

| 组件            | 用途                          | 替换掉的重复实现                                                       |
| --------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `PageHeader`    | 页面主标题 + 说明 + 右侧操作  | 各路由自写的 `<h1 className="text-2xl font-bold …">`                   |
| `SectionHeader` | 区块小标题 + 计数/说明 + 操作 | `<div class="flex items-baseline justify-between"><h2 …>`              |
| `StatusBadge`   | 状态、计数、标签              | `STATUS_STYLE` 映射表与各处拼串的原生 span                             |
| `EmptyState`    | 空态 / 空列表                 | `EmptyCard`、`CardBody` 里包一句灰字                                   |
| `Toolbar`       | 列表筛选行                    | 各列表页自写 `flex flex-wrap items-center gap-* text-muted-foreground` |
| `StatTile`      | 单个统计数字                  | 后台概览里的「标签 + 数字」小卡                                        |
