# VNDB、简介翻译与设备编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成 VNDB 预览导入、可配置 AI 简介翻译和设备图文编辑。

**Architecture:** 在现有 CRUD 编辑表单中加入 VN 专属工具；服务端使用固定 VNDB API 和管理员配置的 OpenAI 兼容接口。新增公开元数据与独立私有配置表，保持原文、译文、个人记录分离。

**Tech Stack:** React Router、React Hook Form、oRPC、Zod、Drizzle/Postgres、Node crypto、Vitest/PGlite、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-16-vndb-ai-device.md`

## Global Constraints

- 仅远程 localhost-1 构建、全量测试、类型检查及浏览器验收；不部署生产。
- VNDB 来源评分与个人评分分开；预览不写库，确认填表后再保存。
- AI 密钥不回显、不进入公开 CRUD、日志或前端构建；使用 BETTER_AUTH_SECRET 加密，备份及轮换须保留该 secret。
- 不自动关联或改写旧资料；译文与原文分别存储。

## Review Focus

- 旧条目个人评分、状态、时长、备注在导入后保持。
- 不同原文重新导入与异步翻译返回时不得误用旧译文。
- 未登录/普通用户无法访问配置、密钥或调用外部服务。
- 地址变更不得把旧密钥发往新地址，上游异常不得泄露正文。
- 重复 VNDB ID 不产生重复关联；旧设备日期、多行规格正确展示。

### Task 1: VNDB 预览导入

**Files:** `packages/db/src/schema.ts`, `packages/db/drizzle/*`, `apps/web/src/server/vndb.ts`, `apps/web/src/server/routers/vndb.ts`, `apps/web/src/server/routers/content.ts`, `apps/web/src/server/router.ts`, `apps/web/src/components/dash/vn-tools.tsx`, `apps/web/src/components/dash/domain-admin.tsx`, `apps/web/src/lib/admin-fields.ts`, `apps/web/src/routes/dash/domain.tsx`, `apps/web/src/routes/site/vn.tsx`.

**Interfaces:** `searchVndb(query: string): Promise<VndbNovel[]>`; `vndb.search({query})` administrator only. `VnTools` fills form fields `vndbId`, `released`, `vndbRating`, `descriptionOriginal`, `descriptionZh`, title/brand/cover/link without personal fields. Public VN list shows metadata and expandable original.

- [x] Write tests for normalization, candidate choice, malformed response, upstream failures, access control, duplicate IDs and preserving personal fields.
- [x] Run targeted Vitest remotely and observe RED.
- [x] Implement bounded, paced, cached VNDB reads and draft-only import UI; generate additive migration remotely.
- [x] Run targeted tests GREEN, remote typecheck, commit.

### Task 2: 私有 AI 配置与简介翻译

**Files:** `apps/web/src/server/ai.ts`, `apps/web/src/server/routers/translation.ts`, `apps/web/src/components/dash/translation-settings.tsx`, settings route, VN tools, schema and migration.

**Interfaces:** `translation.settings()` returns `{baseUrl,model,enabled,hasKey}`; `saveSettings({baseUrl,model,enabled,apiKey?,clearKey?})`; `test()` returns success; `preview({text})` returns `{text,model}`. All administrator only. `translateText(config,text)` uses HTTPS chat/completions, 30 second timeout and bounded text response.

- [x] Write tests asserting encrypted storage, access denial, blank retain/explicit clear, endpoint change needs replacement, invalid config, safe upstream errors, preview never mutates content.
- [x] Run remote RED, implement configuration/adapter and translation preview with original snapshot check, run GREEN.
- [x] Verify pending preview cancellation and source changes in browser; commit.

### Task 3: 设备编辑和交付验收

**Files:** device schema, content router, field registry, device public route; feature Playwright tests and README.

**Interfaces:** Device CRUD adds optional `imageUrl`; image uses existing upload API; `spec` is textarea. Public cards display all saved device information.

- [x] Write regression for image/multiline/date/note roundtrip; remote RED then implement and GREEN.
- [x] Remote full lint, typecheck, unit suite, build; run focused browser tests for configuration, VN import/translation mocks, device and 390/1440 widths.
- [x] Fresh independent whole-branch code review; fix significant findings with RED→GREEN regressions.
- [ ] Commit verified changes, create and attach PR. State real-provider verification pending user configuration; no merge/deployment.
