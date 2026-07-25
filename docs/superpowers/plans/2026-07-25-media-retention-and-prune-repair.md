# 媒体保留策略与清理修复计划

> 状态：待实现（本文件只记录核验结果和执行计划；本轮未删除任何服务器文件）
>
> 范围：Gray / Production 的用户临时上传、生成结果、资源库晋级内容及其后台清理。

## 1. 需求与不变量

1. 用户上传但未保存到资源库的文件只保留 24 小时，超过后删除二进制。
2. 未晋级为资源库素材的生成结果只保留 72 小时（3 天）。
3. 晋级到资源库的素材不受生成库 3 天期限控制，由资源库删除动作管理。
4. 正在上传、正在执行、仍被画布/任务/资源库引用的文件不得删除；删除必须可重试、可审计。
5. 旧服务器保持只读，不在本计划中停止、清理或修改。用户媒体迁移边界不变，不复制旧服务器上的用户图像、视频、音频二进制。

## 2. 只读核验结论（2026-07-25）

### 2.1 代码事实

- `apps/api/src/server.ts:handleMultipartUpload` 将 `/api/files/upload` 文件写入 `users/<owner>/input`，只返回 URL，不登记 `xh_generation_artifacts` 或独立的临时上传记录。
- `saveBase64File`、远程媒体保存和 Worker 物料化结果写入 `output`，通过 `registerApiOutputArtifact` 或 Worker artifact repository 登记。
- `packages/shared/src/generation-artifact.ts` 的 `GENERATION_ARTIFACT_TTL_MS` 为 3 天；repository 未提供 `expiresAt` 时按创建时间加 3 天。
- `scripts/reconcile-generation-artifacts.mjs` 只扫描 `xh_generation_artifacts` 及用户 `output` 目录；`findOutputOrphans` 只报告未登记 output 文件，不删除；不扫描 `input`。
- PostgreSQL reconciliation 已保护有 `promoted_asset_id` 或 `xh_assets` 引用的文件，物理删除失败会留待下次重试。

### 2.2 新服务器证据

- 两套 timer 均已启用：
  - `xinghuan-canvas-output-prune.timer`：每日调度正式环境。
  - `xinghuan-canvas-next-output-prune.timer`：每日 04:15 加 0-15 分钟随机延迟调度灰度。
- 截至核验时，两套 service 均没有近 7 天成功执行记录；timer 是 2026-07-25 部署后才启动，下一次调度尚未发生。手工 dry-run 均可连接数据库并正常退出。
- Gray dry-run：`scannedUsers=6`、`scannedItems=98`，无当前可删除候选；Production dry-run：`scannedUsers=24`、`scannedItems=1935`，无当前可删除候选。
- 数据库状态（迁移时用户媒体未复制，`missing` 不能直接解释为清理失败）：
  - Gray：`deleted=27`、`expired=71`、`missing=84`，总计 182；到期 106、未到期 76。
  - Production：`deleted=4`、`expired=1931`、`missing=1038`，总计 2973；到期 1977、未到期 996。
- 新服务器对应用户媒体目录基本为空，现存文件主要是画布/迁移标记；未发现可据此判断旧二进制清理行为的样本。文件 owner 为 `ubuntu:ubuntu`，与 service 用户一致，当前没有证据表明权限是主要根因。

### 2.3 初步根因

1. 未进入资源库的用户上传没有任何生命周期记录，现有 reconciler 无法发现或删除，这是确定性缺口。
2. output 孤儿只报告不删除，历史未登记 output 会长期留在磁盘，且没有宽限期和删除策略。
3. timer 尚未经过一次真实执行窗口，故“定时清理未生效”还不能归因于 service 失败；必须补充执行日志、摘要和告警。
4. 生成结果的 3 天 TTL 代码已存在，但需要验证所有写入入口都使用同一 TTL，且 upsert 的 `greatest(expires_at, excluded.expires_at)` 不会因重试无限延长生命周期。

### 2.4 旧服务器只读证据

- 旧 Production / Gray 的两个 timer 均已启用，且 2026-07-25 的 service 日志显示 reconciliation 成功退出。
- 旧 Production 的成功运行摘要明确包含多个 `orphanFiles`（例如 `up_...png`），但 `deletedFiles` 中没有这些孤儿；这证明现行逻辑是“发现并记录，不删除”。
- 旧服务器用户 `input/output` 目录仍有大量文件（只读统计约 1,821 个、约 13.2 GiB；Gray 约 97 个、约 67 MiB），旧服务器不能在本任务中清理，必须通过新版本的 dry-run/apply 流程经授权处理。

## 3. 目标数据模型

### 3.1 临时上传登记

新增 owner-scoped 的临时文件登记表（名称可在实现阶段确定，例如 `xh_ephemeral_uploads`），至少包含：

- `id`、`owner_id`、`bucket=input`、`storage_key`、`file_url`、`kind`、`mime`、`size_bytes`；
- `created_at`、`expires_at`（创建时间 + 24 小时）、`status`（active/expired/deleted/missing）；
- `source_canvas_id`、`source_node_id`、`source_task_id`、`metadata`、`last_error`、`deleted_at`。

上传接口必须在文件流成功关闭后再登记；登记失败时保留短暂可重试状态并输出 request ID，不返回可长期使用的 URL。

### 3.2 统一文件定位与引用

- 清理器使用显式 `bucket=input|output` 和 owner 校验的 `storage_key`，禁止拼接任意绝对路径或目录穿越。
- 引用检查统一覆盖：资源库 `xh_assets`、Generation Artifact、有效任务/Canvas Run 输入、仍在处理的上传会话，以及必要的画布 JSON 引用。
- Promotion 将临时上传复制/转移为资源库 Asset 后，原临时记录标记 `promoted` 或 `deleted`，不得再按 24 小时删除资源库二进制。

### 3.3 生成结果 TTL

- 未晋级 artifact：`created_at + 72h`，到期先标记 `expired`，再异步删除 binary。
- `promoted_asset_id` 或等价资源引用存在时，永不由生成清理器删除 binary。
- 重试/幂等回调不得把已创建产物的 `expires_at` 无限向后延长；最多保持原始到期时间，只有明确的新生成任务才创建新的 TTL。

## 4. 清理器设计

将当前单一 output reconciliation 扩展为三个独立阶段，仍保留 dry-run/apply 两种模式：

1. **Ephemeral input prune**：扫描登记表和 `users/*/input`，过期且无引用才删除；未登记文件先进入 orphan 宽限队列，至少等待 24 小时。
2. **Generation artifact reconcile**：沿用 `active/expired/missing/deleted` 状态机，修复 output 路径、引用保护和删除重试；补充 `deletionFailures` 原因和数量。
3. **Orphan sweep**：扫描 input/output 未登记文件，输出文件年龄、owner、大小和原因；只有超过宽限期、无锁/无有效任务引用的文件才可删除。临时上传、迁移残留和刚写入文件必须分别标记，不能把所有 orphan 当垃圾直接删除。

每次运行输出结构化 JSON 摘要并写入当日运维日志/指标：扫描用户数、候选数、删除文件数、释放字节、保护数、失败数、孤儿数和最老未处理年龄。任何删除失败不应让整批静默成功；service 应返回非零或触发告警，保留下次重试。

## 5. 定时与权限

- Gray 与 Production 保持独立 service/timer、独立环境文件和独立摘要目录。
- 首次修复发布只启用 dry-run；连续至少两次 dry-run 结果与人工抽样一致后，才启用 apply。
- service 使用 `ubuntu` 与实际 data 目录 owner 保持一致；发布前检查目录权限、磁盘剩余空间和 systemd `NoNewPrivileges/PrivateTmp` 不阻断目标路径。
- timer 必须在部署后立即执行一次受控 dry-run，并记录 exit code、journal、摘要路径和下一次调度时间。

## 6. 分阶段执行计划与检查门

### Phase 0：基线与保护（只读）

- 记录两环境数据库计数、磁盘目录、权限、timer 状态和备份可用性。
- 为清理器增加结构化 summary schema 和 dry-run golden fixture。
- 门禁：无删除动作；旧服务器无写操作；摘要可复现。

### Phase 1：上传登记与引用契约

- 新增临时上传 migration/repository；改造 multipart、base64 和相关上传入口在流关闭后登记 24h TTL。
- 添加 owner/path 安全检查、重复登记幂等键和 Promotion 迁移规则。
- 测试：上传成功/中断、重复回调、跨用户 URL、资源库晋级、正在运行任务引用。
- 门禁：本地集成测试 + Harness 合同通过；不启用物理删除。

### Phase 2：清理器实现

- 增加 input prune、output orphan 宽限和统一引用保护；修正 artifact TTL upsert 不得延长问题。
- dry-run/apply 都必须可重复，删除逐文件、可重试、可审计。
- 测试：24h/72h 边界、promoted 保护、missing、删除失败重试、并发上传竞态、路径穿越拒绝。
- 门禁：全部单测/集成测试、`verify:generation-artifact-framework-contract` 和 Harness storage/worker 检查通过。

### Phase 3：Gray 实际验证

- 部署到 Gray，先执行两次 dry-run，再以专用测试账号创建：临时 input、未晋级 output、晋级资源、正在运行引用和孤儿样本。
- 人工/脚本核对数据库状态、磁盘文件、HTTP 访问、资源库可见性及 summary/journal；等待或注入可控时间完成 24h/72h 边界验证。
- 门禁：临时上传到期确实删除；生成结果到期确实删除；资源库内容继续可访问；重复执行无副作用；无生产用户数据触碰。

### Phase 4：Production 推进

- 复用 Gray 已验收版本；先备份数据库元数据和清理摘要，执行 Production dry-run 并人工确认候选范围。
- 首次 apply 限定为已确认的临时/生成候选，保留 orphan 宽限期；观察至少一个完整调度周期和失败重试指标。
- 回滚：停用 apply timer、恢复上一 release；不恢复已删除的用户临时文件，资源库文件不得进入删除候选。

## 7. 验证矩阵

| 场景 | 预期 |
| --- | --- |
| 上传 input，未进入资源库，年龄 <24h | 文件和登记保持 active |
| 上传 input，未进入资源库，年龄 >24h、无引用 | 标记 expired/deleted，删除 binary |
| 上传 input，被任务或画布引用 | 延迟删除并记录保护原因 |
| 生成 output，年龄 <72h | artifact active，可见 |
| 生成 output，年龄 >72h、未晋级 | expired 后删除 binary |
| 生成 output 已 Promotion | 生成记录可过期，但资源库 binary 保留 |
| 未登记 input/output，年龄不足宽限期 | 只报告不删除 |
| 未登记文件超过宽限期且无引用 | 删除并记录 orphan 清理证据 |
| 删除权限或文件系统异常 | 记录失败，service 告警/非零，下次重试 |

## 8. 发布与停止条件

在以下任一条件出现时停止扩大范围并回到 dry-run：候选数量异常增长、资源库文件进入删除候选、owner/path 校验失败、summary 与数据库计数不一致、service 非零、磁盘空间或权限异常、Gray 实测无法证明 24h/72h 行为。任何真实删除前必须得到本任务后续明确授权，并在 release/validation 日志记录环境、候选、删除数量、释放空间和复核结果。
