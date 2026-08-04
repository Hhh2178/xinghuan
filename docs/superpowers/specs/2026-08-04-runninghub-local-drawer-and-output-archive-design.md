# RunningHub 局部分组抽屉与输出归档下载设计

## 状态

- 日期：2026-08-04
- 状态：Approved for planning
- 范围：Admin / Canvas / API / Worker / Storage / Observability / Gray Release
- 取代：`2026-08-04-runninghub-group-drawer-design.md` 中关于全屏遮罩、模态语义和背景不可操作的要求

## 背景

RunningHub 管理工作台的分组面板已经移动到左侧条目 rail，并与分组触发器和条目卡片使用同一宽度轨道。但是实现仍保留旧全屏模态抽屉的 backdrop：它覆盖整个 viewport，并使用 `backdrop-filter: blur(3px)`。因此点击“分组筛选”后，右侧编辑区和其他页面内容仍被模糊，交互语义与当前局部抽屉位置不一致。

画布 RunningHub 节点当前可以提交任务、按 `taskId` 轮询并在成功后获得本次任务的输出 URL。Worker 已经负责把 Provider 输出物料化为 owner-scoped 本地文件并登记 Generation Artifact。用户希望在节点上增加“完成后打包下载”开关：打开后，本次 RH 节点产生的全部可用输出自动组成一个 ZIP，并通过浏览器默认下载行为下载到用户电脑。

输出可能包含大尺寸视频。多个用户或多个 RH 节点也可能同时完成，不能在 API 请求内并发读取、压缩和缓存大文件，也不能让每个 Worker 实例各自启动一个归档任务。本设计因此引入一个低优先级、持久化、全站单并发的输出归档队列。

## 目标

1. 分组筛选面板仅覆盖 RunningHub 左侧条目 rail，不模糊、不遮挡、不禁用右侧工作区。
2. RH 节点提供持久化的“完成后打包下载”开关，默认关闭。
3. 自动归档只使用当前 owner、当前任务的服务端权威输出，不接受客户端提供任意文件 URL。
4. 全站同一时间最多生成一个 ZIP；多个归档任务按公平队列依次执行。
5. 大文件全程流式处理，内存占用不随文件总大小线性增长。
6. 已压缩媒体只装入 ZIP，不进行无收益的二次压缩。
7. 归档失败、下载失败或浏览器阻止自动下载时，不改变 RH 生成任务的终态。
8. 临时 ZIP 有明确的大小上限、磁盘余量检查、到期清理和故障恢复边界。
9. 首次只发布 Gray，Production 保持不变。

## 非目标

- 不改变 RunningHub Provider 提交、计费、轮询和物料化协议。
- 不把 ZIP 登记为 Generation Artifact、长期素材或资源库资产。
- 不让浏览器从任意 Provider URL 拉取并压缩文件。
- 不为历史已完成节点在打开画布时自动触发下载。
- 不新增移动端专用交互或验收矩阵。
- 不在首版提供用户可调的压缩级别、归档格式或目录结构。
- 不保证绕过浏览器“每次询问保存位置”的用户设置；网页只触发标准同源下载。

## 已确认决策

### 分组抽屉

- 分组面板是 rail-local 非模态抽屉，不是全屏 modal。
- 删除全屏 backdrop DOM 和对应模糊样式。
- 抽屉与触发器、条目卡片继续共享同一 rail track 宽度。
- 保留关闭按钮和 `Escape`。
- 点击抽屉与触发器之外的区域时关闭抽屉，但不拦截该次点击对右侧正常控件的操作。
- 使用 `aside` 或 `role="region"` 的局部区域语义，不再使用 `aria-modal="true"`。

### 输出归档

- 采用服务端异步生成 ZIP，浏览器不执行客户端压缩。
- 归档任务使用 PostgreSQL 作为状态权威源；Redis 不保存归档任务终态。
- 归档处理器位于 Worker 边界，API 只负责鉴权、入队、查询状态和下载 ready 文件。
- 全站归档生成并发固定默认为 `1`，并通过数据库全局租约保证多 Worker 实例下仍只有一个运行任务。
- 队列按 owner 轮转，同一 owner 内按创建时间排序，避免一个用户连续占满全局队列。
- 成功物料化的所有文件都会进入 ZIP。部分输出缺失时仍生成 ZIP，并在 `manifest.json` 中记录缺失项；零个本地可用文件时归档失败。
- 图片、视频和音频默认使用 ZIP store 模式；`manifest.json` 使用普通 deflate。
- 相同 owner、source task 和输出指纹复用现有 queued/running/ready 归档，不重复生成。

## Admin 局部抽屉设计

### 结构

`AdminRunningHubWorkspace` 继续持有 `groupDrawerOpen` 和既有分组操作 handler。`AdminRunningHubGroupManager` 继续渲染在 `admin-runninghub-workspace__rail-track` 内，并绝对定位覆盖触发器下方的条目区域。

抽屉打开时：

1. 左侧 rail 内显示不透明抽屉。
2. 右侧编辑区保持原始清晰度和正常交互。
3. 点击抽屉内不关闭。
4. 点击触发器不产生立即关闭再打开的竞态。
5. 点击其他区域先关闭抽屉，同时保留原点击行为。
6. `Escape` 和关闭图标均可关闭。

### 视觉

- 抽屉左右边界与条目卡片一致。
- 不增加额外全屏遮罩、渐变或模糊效果。
- 使用现有 rail 实色背景、边框和局部阴影表达层级。
- 不改变条目标题、备注、Schema 摘要、状态和底部信息的字体与密度。
- 桌面视觉验收只使用 `1920x1080`。

### 组件与测试修正

现有 source-contract 测试明确要求 backdrop、`position: fixed` 和 `aria-modal="true"`，必须改为验证：

- backdrop 不再渲染；
- 抽屉仍在 rail track 内；
- 抽屉使用局部绝对定位；
- 触发器、抽屉和条目卡片共享左右边界；
- Escape、关闭按钮和外部点击关闭仍存在。

## RH 节点交互设计

### 开关位置

在 `RunningHubNodeConfigSection` 的运行配置区域增加一行紧凑设置：

```text
完成后打包下载                     [开关]
```

开关使用现有节点主题色，保持固定高度和稳定左右布局，不压缩后台条目名称、参数文本或输出预览。配置写入节点序列化数据：

```ts
autoDownloadArchive: boolean
```

缺失字段按 `false` 处理，保证历史画布兼容。

### 生效规则

- 在当前浏览器会话中，开关开启且节点进入新的 submitting/polling/running 状态时，自动归档逻辑进入 armed 状态。
- 运行期间打开开关，当前任务允许进入 armed 状态。
- 任务已经终态后再打开开关，不自动下载旧结果；用户可以通过手动“下载 ZIP”入口操作。
- 开关关闭时不再为后续任务入队。
- 已经 queued 的归档可请求取消；已经 running 的归档执行 best-effort 中止并删除本次 `.part` 文件。
- 页面关闭无法保证取消；服务端继续完成或由 TTL 清理。

### 状态显示

节点只显示紧凑状态，不扩展成新的大型面板：

- 等待打包
- 正在打包
- 准备下载
- 已触发下载
- 下载失败，可重试
- 无可归档输出

不显示持续更新的百分比，避免为大文件进度频繁写数据库。可以显示稳定的文件数和总源文件大小。

### 前端封装

自动归档生命周期封装为独立 hook，例如 `useAutoDownloadTaskArchive`。它负责：

- armed 状态；
- 创建或复用归档任务；
- 查询归档状态；
- `taskId` 级去重；
- `sessionStorage` 会话去重；
- ready 后触发同源 `<a download>`；
- 自动下载失败后的手动重试；
- 组件卸载时停止客户端轮询。

`RunningHubNode` 只负责传入 node ID、task ID、开关值、运行状态和输出存在性，不直接实现 ZIP、文件收集或队列状态机。

## 服务端权威边界

### 输出来源

客户端创建归档任务时只提交 source `taskId`，不得提交待归档 URL 列表。API 根据当前用户读取任务和任务结果，并以以下服务端记录为权威来源：

1. `generationArtifactIds` 对应的当前 owner Generation Artifact；
2. task result 中经过服务端物料化确认的 owner-scoped `/files/output/` URL；
3. 为兼容旧 RH 任务而存在的、能够安全解析到当前 owner 输出目录的本地 URL。

远程 `http/https` URL、`data:` URL、其他 owner 文件、输入目录文件、嵌套路径、目录穿越和符号链接越界全部拒绝。归档 Worker 不代表用户重新请求 Provider，也不使用 Provider 密钥回源。

### 输出指纹

输出指纹由以下稳定信息生成：

- owner ID；
- source task ID；
- 已排序 Artifact ID 或规范化文件相对路径；
- 每个文件的大小和修改时间；
- 归档格式版本。

指纹相同的 queued、running 或未过期 ready job 直接复用。文件集合或文件元数据变化后生成新 job。

## API 合同

### 创建或复用归档

```text
POST /api/tasks/:taskId/output-archives
```

返回：

```json
{
  "jobId": "archive-job-id",
  "status": "queued",
  "reused": false,
  "fileCount": 3,
  "sourceBytes": 123456,
  "expiresAt": null
}
```

规则：

- 必须登录并拥有 source task。
- source task 必须处于终态并至少拥有一个当前 owner 的本地可用输出；终态可以是 succeeded，也可以是保留了部分物料化输出的 failed/cancelled。
- 同一 owner 默认最多保留 2 个 queued job；重复指纹复用不占新名额。
- 超过限制返回稳定错误码，不静默丢弃任务。

### 查询状态

```text
GET /api/output-archives/:jobId
```

只返回当前 owner 的归档状态、文件数、源大小、归档大小、错误码和到期时间，不返回服务器绝对路径。

### 下载

```text
GET /api/output-archives/:jobId/download
```

仅 `ready` 或 `downloaded` 且未过期时返回：

```text
Content-Type: application/zip
Content-Disposition: attachment; filename*=UTF-8''...
Content-Length: <archive bytes>
```

下载使用流式文件响应。响应完成后记录 `downloadedAt` 和 `downloadCount`，但不立即删除文件，允许网络失败后的重试。

### 取消

```text
DELETE /api/output-archives/:jobId
```

- queued：直接转为 cancelled；
- running：写入 cancel requested，Worker 在流或文件边界中止；
- ready：删除明确的归档文件并转为 cancelled；
- downloaded/expired/failed：幂等返回当前状态。

## 持久归档队列

### 数据模型

新增 owner-scoped `xh_output_archive_jobs`，至少包含：

- `id`
- `owner_id`
- `source_task_id`
- `source_fingerprint`
- `status`
- `file_count`
- `source_bytes`
- `archive_bytes`
- `archive_relative_path`
- `archive_filename`
- `manifest`
- `error_code`
- `lease_owner`
- `lease_expires_at`
- `heartbeat_at`
- `cancel_requested_at`
- `download_count`
- `downloaded_at`
- `expires_at`
- `created_at`
- `updated_at`

状态集合：

```text
queued -> running -> ready -> downloaded
       -> cancelled
running -> cancelled
running -> failed
ready/downloaded -> expired
```

`downloaded` 表示至少一次完整响应结束，不代表客户端一定永久保存文件；文件仍保留到 `expires_at`。

### 全局单槽

新增一个 PostgreSQL 全局归档调度槽或等价的 durable lease。Worker 必须先取得全局槽，再领取 job。默认配置：

```text
OUTPUT_ARCHIVE_GLOBAL_CONCURRENCY=1
```

即使同时运行多个 Worker 实例，也只能有一个实例持有归档槽。持有者定期刷新 slot lease 和 job heartbeat。连续刷新失败时必须中止当前写流并停止领取新任务，避免租约失效后旧 Worker 与新 Worker 并发打包。

### 公平领取

使用与 Canvas Run owner cursor 相同的公平性原则：

1. 每次只为一个 owner 领取一个最早 queued job。
2. 完成或释放全局槽后推进 owner cursor。
3. 下一次从上次 owner 之后环状选择仍有 queued job 的 owner。
4. 同一 owner 内严格按 `created_at, id` 排序。

这保证全局串行，同时避免单个用户的大批量任务长期阻塞其他用户。

### 优先级

归档队列是低优先级内部 I/O 队列，不进入 Provider capability 队列，也不占 RH Key 并发窗口。归档 Worker 启动和领取必须可通过环境开关关闭；关闭时 queued job 保留，不伪装成 running。

## ZIP 生成策略

### 文件处理

- 使用支持 Node.js stream 和 backpressure 的 ZIP 库。
- 禁止 `readFile` 聚合完整媒体文件。
- 图片、视频、音频使用 store 模式，避免重复 deflate。
- 小型 JSON manifest 可以 deflate。
- 每个源文件打开前重新 `stat` 并校验 owner 路径和文件类型。
- ZIP 先写唯一同目录 `.part` 文件，成功 finalize 后原子 rename 为 `.zip`。
- 失败或取消只删除当前 job 明确创建的 `.part`，不触及源文件、其他归档或 release。

### ZIP 内部命名

文件按服务端确定的稳定顺序写入：媒体类型、Artifact ID 或规范化路径、原始索引。名称采用：

```text
images/001-<safe-original-name>
videos/001-<safe-original-name>
audios/001-<safe-original-name>
other/001-<safe-original-name>
manifest.json
```

重名文件使用稳定数字前缀。所有名称必须去除路径分隔符、控制字符和跨平台非法字符。

### Manifest

`manifest.json` 至少记录：

- schema version；
- source task ID；
- 创建时间；
- 成功归档文件的类型、ZIP 路径、源大小和 Artifact ID；
- 缺失、拒绝或在归档时消失的文件及稳定原因码；
- 汇总文件数和字节数。

Manifest 不包含绝对路径、Provider 凭据、请求头、用户隐私字段或远程授权 URL。

## 容量与资源保护

### 默认限制

```text
OUTPUT_ARCHIVE_MAX_PENDING_PER_OWNER=2
OUTPUT_ARCHIVE_TTL_MINUTES=120
OUTPUT_ARCHIVE_MAX_BYTES=8589934592
OUTPUT_ARCHIVE_RESERVED_DISK_BYTES=10737418240
```

含义：

- 单个归档默认最多 8 GiB 源文件；
- 文件系统在预计写入 ZIP 后必须至少保留 10 GiB 可用空间；
- ready/downloaded ZIP 默认保留 2 小时；
- 每个 owner 最多有 2 个非复用 queued job。

Gray 和 Production 可以使用非密环境配置降低限制，但不能把全局并发提高到 `1` 以上，除非形成新的容量验证和架构评审。

### 预检

API 入队前根据权威文件记录计算初始大小；Worker 运行前再次 `stat` 并使用文件系统容量信息复核。任一条件失败时使用稳定错误码：

- `archive_too_large`
- `insufficient_archive_disk`
- `too_many_pending_archives`
- `no_materialized_outputs`

### 运行时内存

实现必须依赖固定大小流缓冲和 backpressure。验收目标不是承诺某个 Node heap 精确数值，而是证明归档峰值内存不会随测试文件总大小近似线性增长，且不会把完整文件大小计入单个 Buffer。

### 清理

Worker 定期扫描明确到期的 job：

1. 使用 owner ID 和 job ID 解析预期归档路径。
2. 再次验证路径仍在归档根目录内。
3. 一次只删除一个明确文件。
4. 删除成功后转为 expired 并清空可下载路径。
5. 删除失败保留记录并在下一轮重试。

清理器不扫描或删除 Generation Artifact、用户上传、长期素材、release 或未知文件。

## 故障恢复与幂等

- Worker 崩溃：job lease 到期后重新排队；旧 `.part` 只按明确 job 路径清理。
- 数据库 heartbeat 失败：当前 Worker 中止归档，不继续无租约写入。
- 文件在打包前消失：记录 manifest 缺失项；仍有其他文件则继续。
- 文件在流式读取中消失或读取失败：当前 ZIP 失败，不发布半成品；重试时重新构建完整 ZIP。
- ZIP finalize 或 rename 失败：job 失败，删除当前 `.part`。
- 自动下载被浏览器阻止：job 保持 ready，节点显示手动重试入口。
- 下载连接中断：ZIP 保留到 TTL，用户可再次下载。
- 页面刷新或 RH 轮询重入：`sessionStorage` 和 source fingerprint 防止同一任务重复入队与重复自动触发。
- source task 的输出集合发生变化：旧 ready job保持到期，新指纹允许生成新归档。

## 安全与权限

- 所有创建、查询、取消、下载操作都要求当前会话用户拥有 source task 和 archive job。
- 管理员权限不自动等于读取其他用户归档；跨 owner 运维必须使用独立审计接口，本功能不提供。
- archive relative path 永远由服务端生成，不接受请求体路径。
- 所有路径在打开文件和响应下载前都要解析并验证在 owner archive root 内。
- 拒绝符号链接、目录、设备文件和非普通文件。
- 日志只记录 job ID、owner 哈希或内部 ID、task ID、状态、文件数、字节数、耗时和稳定错误码，不记录密钥、下载授权头或绝对路径。

## 可观测性

至少记录以下指标：

- queued job 数；
- oldest queued age；
- running job 是否存在；
- archive success / partial / failed / cancelled / expired 计数；
- source bytes、archive bytes、处理耗时；
- owner fairness cursor；
- lease takeover 次数；
- 自动下载触发成功和手动重试次数；
- 磁盘余量拒绝和大小上限拒绝次数。

Admin 系统健康页首版只需要提供摘要数据，不新增大型独立页面。Gray 验收必须能区分“RH 生成排队”和“输出归档排队”。

## 数据迁移与兼容

- 使用新的前向 PostgreSQL migration 创建 archive job、全局 slot 和 owner cursor 结构。
- Migration 必须先于启用 archive worker 和前端开关。
- 历史节点缺少 `autoDownloadArchive` 时默认关闭，不批量改写画布 JSON。
- 功能使用环境开关分层启用：先数据库与 API，再 Worker，最后 Gray Web UI。
- 回滚 UI 或 Worker 时保留 job 表和历史记录；关闭领取后 queued job 不丢失。
- 回滚到上一 Gray release 前先停止 archive worker 领取，允许当前 job完成或租约过期，不删除源输出。

## 测试设计

### Admin

- backdrop DOM 和 blur 样式不再存在。
- 非模态语义正确。
- 外部点击、Escape 和关闭按钮可关闭。
- 抽屉、触发器和条目卡片宽度对齐。
- 1920x1080 实际浏览器截图无模糊、覆盖和文本压缩。

### Canvas Web

- 历史节点默认关闭。
- 开关持久化并保持节点布局稳定。
- 新 task 进入运行态时 armed；打开旧成功画布不自动下载。
- 相同 taskId 只创建或复用一个 job，只触发一次自动下载。
- queued/running/ready/failed/cancelled 状态正确显示。
- 归档失败不改变 RH task success/error 状态。
- 浏览器拒绝自动下载时保留手动入口。

### API

- owner 鉴权覆盖创建、状态、取消和下载。
- 客户端 URL 注入、路径穿越、符号链接和跨 owner 文件被拒绝。
- 重复指纹复用 job。
- pending 限制、大小限制、磁盘余量和零输出错误码稳定。
- ready ZIP 使用正确响应头且不泄露绝对路径。

### Worker

- 多 Worker 并发领取时全局最多一个 running job。
- owner round-robin 不被单一 owner 饥饿占用。
- store 模式和流式 backpressure 生效。
- heartbeat、lease takeover、取消、失败清理和原子 rename 可恢复。
- 部分缺失仍生成 ZIP 与 manifest；零文件失败。
- 同一 job 重试不会发布重复或半成品 ZIP。
- 到期清理只删除明确归档文件。

### 集成与容量

- 同时入队至少三个不同 owner/job，证明严格串行和公平顺序。
- 使用足够大的本地测试文件验证进程不会把完整文件读入单一 Buffer。
- 下载中断后可以重新下载同一 ready ZIP。
- Gray 上使用真实 RH 多输出任务验证自动入队、排队、ready、浏览器下载和 TTL 清理。
- Gray 期间确认 API 延迟、Worker Provider 队列和 RH 并发窗口没有明显回退。

## 实施边界

建议按以下独立提交推进：

1. 修复 Admin rail-local 抽屉残留及测试。
2. 新增 archive 数据模型、repository、API 合同和权限测试。
3. 新增全局单槽、公平队列、ZIP stream、容量保护和 Worker 测试。
4. 新增 Web archive client、hook、RH 节点开关和状态 UI。
5. 同步 ADR、系统文档、环境配置、Harness、验证与发布记录。
6. 递增当前 Gray patch 版本，部署 Gray 并完成真实浏览器与多任务串行验证。

不在同一提交中混入 Production 发布、其他节点的批量下载改造或无关热点文件重构。

## Gray 发布与回滚

- 当前设计目标是下一次 Gray patch release；发布时以根 `package.json` 和 `ops/current/release-state.json` 再确认实际版本。
- Migration 先执行，随后启动 API 和 Worker，最后切换 Web/Admin。
- Gray 验证通过前不修改 Production。
- 归档功能必须有运行时开关；发生容量、队列或文件安全异常时关闭新 job 入队和 Worker 领取，现有 RH 生成链路继续工作。
- 回滚应用 release 不回滚数据库 migration，不删除 archive job 历史和源输出。
- 到期临时 ZIP 继续由兼容清理器按明确路径处理。

## 验收标准

1. 点击“分组筛选”后只有左侧 rail 显示抽屉，整个页面不再模糊，右侧编辑区可以正常点击。
2. 分组抽屉与触发器、条目卡片左右边界一致，文本宽度和密度不回退。
3. RH 节点出现默认关闭的“完成后打包下载”开关，历史画布行为不变。
4. 开启后，本次任务的所有可用本地输出进入一个 ZIP；部分缺失写入 manifest，零输出明确失败。
5. 同时提交多个归档任务时，全站始终最多一个 running，并按 owner 公平轮转。
6. 大媒体通过流式 store 模式处理，API 不执行压缩，Worker 不把完整媒体读入内存。
7. 重复请求复用相同归档；下载失败可以重试；打开旧画布不会自动下载旧任务。
8. 越权、任意 URL、目录穿越、符号链接和磁盘不足均被安全拒绝。
9. 临时 ZIP 在 TTL 后逐个清理，不影响源文件、Generation Artifact、长期素材和 release。
10. focused tests、相关 package typecheck/build、项目 Harness、1920x1080 Admin/Canvas 视觉验收和 Gray 多任务串行验证全部通过。
