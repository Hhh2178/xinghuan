# 当前修复与清理进度 - 2026-06-08

## 目的

这份文档用于集中记录当前本机修复、重构、验证和文档清理状态，避免继续依赖散落在 `DEVLOG.md`、`docs/prd/v0.1.0/progress.md` 和早期 `ops/*.md` 中的旧状态判断。

## 当前代码进度

当前分支：`xinghuan-milestone-b`

最近完成的本机收口：

| 提交 | 范围 | 状态 |
| --- | --- | --- |
| `05c7fc2` | GRSAI 图像参考图本地参数修复 | 已提交，本机验证通过，未单独推灰度/生产 |
| `cc78a44` | 管理后台确认动作弹窗抽离 | 已提交，本机验证通过，未单独推灰度/生产 |
| `7dae809` | 管理后台手动模型弹窗抽离 | 已提交，本机验证通过，未单独推灰度/生产 |
| `4552a3f` | 管理后台总览面板抽离 | 已提交，本机验证通过 |
| `e2ca089` | 管理后台用户面板抽离 | 已提交，本机验证通过 |
| `016a6c4` | 管理后台任务面板抽离 | 已提交，本机验证通过 |
| `dcca705` | 入口 UI Google/Gemini 设计 brief 补强 | 已提交，仅文档收口 |

当前未提交但已验证通过的后台拆分收口：

- `apps/admin/src/main.tsx` 已重写为薄壳入口，只保留认证、导航、统一数据加载与页面切换。
- 新增 `apps/admin/src/admin-types.ts`、`admin-api-settings-panel.tsx`、`admin-model-picker.tsx`、`admin-model-editor.tsx`、`admin-runninghub-panel.tsx`、`admin-lora-panel.tsx`。
- `ModelPicker` 已修复已存在模型能力分类优先级问题，避免旧模型被误判为图像模型。

## 当前验证状态

本轮 GRSAI 图像参考图本地参数修复的最新验证：

- `npm run verify:grsai-reference-images-contract`
- `npx tsx scripts/verify-grsai-image-adapter.ts`
- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/worker`
- `npm run verify:provider-file-access-contract`
- `npm run verify:worker-grsai-contract`

上一轮确认动作弹窗抽离的验证：

- `npm run verify:admin-confirm-action-dialog-contract`
- `npm run type-check -w @xinghuan/admin`
- `npm run build -w @xinghuan/admin`
- `npm run verify:admin-interaction-guards`
- `codegraph sync`
- `codegraph status`

上一轮手动模型弹窗抽离的验证：

- `npm run verify:admin-manual-model-dialog-contract`
- `npm run verify:admin-view-model-contract`
- `npm run type-check -w @xinghuan/admin`
- `npm run build -w @xinghuan/admin`
- `npm run verify:admin-interaction-guards`
- `codegraph sync`

本轮 Provider 面板拆分与主入口薄壳化验证：

- `npm run type-check -w @xinghuan/admin`
- `npm run verify:admin-confirm-action-dialog-contract`
- `npm run verify:admin-manual-model-dialog-contract`
- `npm run verify:admin-overview-panel-contract`
- `npm run verify:admin-readonly-panels-contract`
- `npm run verify:admin-task-panel-contract`
- `npm run verify:admin-users-panel-contract`

## 当前未提交运行期数据

以下文件属于本机运行期数据脏改动，本轮不提交、不清理、不删除：

- `apps/api/data/admin/admin.json`
- `apps/api/data/auth/auth.json`
- `apps/api/data/users/usr-admin/canvases/canvas-1780635027412-0epdrp.json`
- `apps/api/data/users/usr-admin/canvases/canvas-list.json`

## 文档清理原则

本次清理只清除“活跃入口中的废旧状态”，不批量删除历史发布证据。

保留原因：

- `ops/phase*.md`、`ops/gray-*.md`、`ops/production-*.md` 多数是灰度/生产发布审计证据。
- `ops/old-canvas-cleanup-2026-06-04.md` 是旧项目服务器清理的最终证据，不应删除。
- `ops/server-disk-usage-2026-06-04.md` 记录旧项目清理后的磁盘状态，可作为服务器容量历史。

已从活跃视图清理或降级的旧记录：

| 旧记录 | 处理方式 | 原因 |
| --- | --- | --- |
| `ops/README.md` 中“生产目标预留” | 改为生产已切换到 `canvas.hhh2121.xyz` | 生产已经完成切换，旧表述会误导 |
| `ops/README.md` 中“旧项目服务不要停止或覆盖” | 改为旧项目已清理、历史记录保留 | 旧无限画布服务器运行态已清理 |
| `ops/README.md` 中早期灰度材料列表 | 改为按“当前运行态、最新验收、历史记录”分层 | 早期 6 月 5 日材料不应再作为当前入口 |
| `docs/prd/README.md` 当前版本日期 | 更新到 `2026-06-08` | 当前本机已经继续推进后台重构 |

保留但不作为当前状态入口的历史记录：

- `ops/domain-map-2026-06-04.md`
- `ops/server-state-2026-06-04.md`
- `ops/gray-deploy-2026-06-05.md`
- `ops/gray-auth-deploy-2026-06-05.md`
- `ops/gray-admin-deploy-2026-06-05.md`
- `ops/gray-admin-security-2026-06-05.md`
- `ops/gray-db-readiness-2026-06-05.md`
- `ops/postgresql-gray-migration-2026-06-05.md`
- `ops/postgresql-repository-cutover-2026-06-05.md`
- `ops/worker-queue-gray-deploy-2026-06-05.md`

如后续需要真正删除历史文件，必须逐个文件确认并逐个删除，不能批量删除目录或通配删除。

## 下一步

- 继续把 `admin-api-settings-panel.tsx` 中的 helper 和导入/保存逻辑下沉为更小的纯逻辑模块。
- 视需要补 `verify:admin-api-settings-panel-contract`，避免后续继续拆 Provider 面板时回归。
- 如果要做文档瘦身，下一步应先建立 `ops/_archive/README.md` 或归档索引，再逐个迁移或删除明确不再需要的历史文件。
- 灰度/生产发布前，需要重新运行对应服务器验收，不使用这份本机修复文档替代部署验收。
