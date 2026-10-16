# Daily Record Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 前台公开每日自慰次数及 GitHub 风格绿色日历，后台编辑记录。
**Architecture:** 独立按日期唯一的每日次数表；公开按年读取，管理员写入。复用站点东八区时间与现有组件，纯函数生成全年日历。
**Tech Stack:** React Router、oRPC、Drizzle/Postgres、Vitest/PGlite、Playwright。
**Spec:** 用户已确认全部公开；只记录日期和当日次数，前台展示、后台编辑。VNDB 按另行确认的预览单独导入，保留个人字段。

## Global Constraints

- 本机只读改代码；构建、迁移生成和回归在 localhost-1。
- 新功能只交付 PR，不合并或部署；新表初始为空，不虚构数据。
- 日期按 Asia/Shanghai；日期真实有效，不能记录未来日期；每日唯一。0 表示清除当天记录。
- 公开 API 不含账户、会话或内部日志字段；写接口沿用管理员权限。

## Review Focus

- 闰年、周日/周一跨年、月标签和浏览器时区不同仍不漏日或错日。
- 并发「+1」不得丢次数；手动保存同一日期更新，0 清除。
- 匿名/普通用户可读但不能写；后台新增路由不能被通用 CRUD 抢占。
- 小屏只在日历内部横向滚动，格子可用键盘选择，次数有文本说明。
- 日期跨年保存后，编辑值和热力图/汇总应刷新到同一年。

### Task 1: 日期模型与公开读/管理员写接口

**Files:** `packages/db/src/schema.ts`, `packages/db/drizzle/*`, `apps/web/src/lib/daily-record.ts`, `apps/web/src/server/routers/daily-record.ts`, tests and router registration.
**Interfaces:** `todayInShanghai(now?:Date):string`, `buildYearHeatmap(year,days,today)`; `dailyRecord.year({year}) → {year,today,days:[{date,count}]}`; `save({date,count})`, `increment({date})`. Count integer 0..1000; increment atomic.

- [x] Write and remotely run failing behavior tests: leap days, future/invalid dates, yearly boundaries, permission, overwrite/delete, atomic increments.
- [x] Implement date helpers, table and router; generate migration remotely; tests GREEN.

### Task 2: 公开页面、后台编辑和日历

**Files:** public/dash routes, calendar/shared UI, route and domain registries, feature Playwright tests, README.
**Interfaces:** `/masturbation?year=YYYY` public; `/dash/masturbation` admin. Annual totals/day count/max, green 0/1/2/3/4+ scale, selectable days, year navigation. Editor date/count/save/clear/+1.

- [x] Add browser regression for public visibility, edit/backfill/update/clear and mobile calendar containment.
- [x] Implement responsive calendar and forms, use text dates and explicit today to avoid hydration drift.
- [x] Remote lint/typecheck/unit/build, focused browser acceptance, independent whole-branch review; fix material findings.
- [ ] Commit, create/attach PR, await CI and report no production rollout of new page.
