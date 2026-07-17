# 生成产物生命周期治理规格

## Problem

当前生成库依赖 Canvas 扫描节点后并发登记到用户 JSON；Worker 同时把任务输出直接写入长期资源表。读取生成库还会触发过期清理。并发写、页面未打开、读取副作用和双重实体语义会造成条目丢失、文件漂移和三天规则失真。

## Goals

- Generation Artifact 由服务端登记并以 PostgreSQL 为生产权威源。
- Generation Library 是当前用户短期产物的只读查询视图。
- Resource Asset 只通过显式 Promotion 创建，不再由所有任务输出自动产生。
- 三天期限、删除、缺失检测和物理清理由显式生命周期命令执行。
- 历史 `generation-library.json` 可审计、幂等迁移，损坏文件不得被覆盖。
- file 模式保留为本地兼容 adapter，并使用串行、原子写入。

## Non-goals

- 本批次不迁移对象存储。
- 本批次不直接执行 Gray / Production 数据迁移或发布。
- 本批次不删除服务器历史 JSON、资源记录或输出文件。
- 不改变资源库已有人工分类、收藏和长期素材。

## Users And Permissions

- 用户只能查询、访问、删除和晋级自己的 Generation Artifact。
- 所有 repository 查询必须以 `owner_id` 为条件；前端过滤不能作为隔离手段。
- Promotion 同时校验 artifact owner，生成的 Resource Asset 继承 owner。

## Current Behavior

- Canvas `useEffect` 扫描节点中的 `/files/output/` 并并发 POST。
- API 用无锁整文件覆盖维护 `generation-library.json`。
- GET 查询和内容读取调用 cleanup 并可能写文件、删文件。
- Worker 把每次任务输出写入 `xh_assets`，用 `task-output` 标签表达临时性。
- 清理脚本扫描 `xh_assets` 或 `resource-library.json` 推断哪些“资源”其实是临时输出。

## Proposed Behavior

### Deep Module

`GenerationArtifactLifecycle` module 提供一个集中 interface：

- `registerBatch`：Worker 物料化后幂等登记。
- `listActive` / `findOwned`：只读查询。
- `deleteOwned`：显式逻辑删除，返回物理文件处理决定。
- `promoteOwned`：事务性创建 Resource Asset 并更新晋级关系。
- `expireAndReconcile`：显式推进过期/缺失状态并生成审计摘要。
- `importLegacy`：从历史 JSON 幂等回填。

### Persistence

- 新表 `xh_generation_artifacts` 保存 owner、kind、status、storage key、URL、来源任务/画布/节点、provider/model、创建/过期时间和晋级关系。
- 唯一约束保证同一用户、任务和 storage key 重试不会重复。
- Production/Gray 使用 PostgreSQL adapter；本地 file adapter 使用原子 rename 和每用户写队列。

### Lifecycle

- `active`：生成库可见且未过期。
- `promoted`：已经创建长期 Resource Asset，在期限内仍可见。
- `expired`：超过生成库期限，不再可见。
- `missing`：元数据存在但文件缺失。
- `deleted`：用户显式删除。

GET 只按状态和 `expires_at` 过滤，不推进状态、不写文件。

### Promotion

- 新增 `POST /api/generation-library/items/:id/promote`。
- 使用稳定 `asset-<artifact-id>`，重复请求返回同一 Resource Asset。
- promoted artifact 的文件不能被生成库清理删除。

## Data And API Contracts

- `GET /api/generation-library/items`：返回当前 owner 的 `active/promoted` 且未到期条目。
- `POST /api/generation-library/items`：只作为旧客户端兼容登记；新 Canvas 不再调用。
- `DELETE /api/generation-library/items/:id`：显式逻辑删除。
- `POST /api/generation-library/items/:id/promote`：晋级长期素材。
- Worker task result 新增 `generationArtifactIds`；旧 `resourceItemIds` 暂时保留兼容投影。

## Acceptance Criteria

- 两个并发/重复任务登记不会丢条目或产生重复记录。
- 关闭 Canvas 页面不影响 Worker 生成产物进入生成库。
- GET 路由没有数据库状态推进、JSON 写入或文件删除。
- 三天过期由 dry-run/apply 生命周期命令管理。
- Promotion 幂等并保护对应文件。
- JSON 迁移遇到损坏文件只报告，不覆盖；重复运行不重复插入。
- file adapter 并发写使用串行队列和原子替换。
- Canvas 自动登记 effect 被移除。

## Risks

- 历史 `xh_assets` 中 `task-output` 记录与新 artifact 可能短期重叠；迁移和 reconciliation 必须报告而不是自动删除。
- 所有输出生产路径未必都经过 Worker；兼容 POST 暂时保留，并需要运行态指标确认后再移除。
- 数据库迁移必须先于新 Worker/API 启动。

