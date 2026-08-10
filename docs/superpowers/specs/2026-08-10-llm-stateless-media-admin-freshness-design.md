# LLM 无上下文、可移植媒体引用与后台数据新鲜度设计

## 文档状态

- 状态：`Accepted for planning / implementation not started`
- 日期：`2026-08-10`
- 目标分支：`feature/canvas-agent-runtime`
- 适用范围：无限画布 LLM / Vision 节点、外部多模态 Provider 请求边界、Admin 查询缓存与跨会话刷新
- 已确认方案：采用方案 1，即“精准失效 + 写后权威重读 + revision/SSE 跨会话同步”；不清空全部缓存，不迁移到新的前端数据框架
- 发布边界：本文只定义设计；服务器部署、Gray 晋级、Production 晋级和 GitHub 主支合并仍需在实施阶段按授权执行

## 1. 问题定义

本轮同时处理三个相互关联但必须保持独立边界的问题：

1. LLM / Vision 节点把既往用户消息、助手回复和媒体再次放进下一次 Provider 请求，导致节点形成隐式上下文。产品已确认该节点应当是每次独立执行的处理节点，不是持续聊天会话。
2. 公共资源、共享工作流和生成库使用站内相对内容地址；当前 Provider 请求只规范化 `/files`、`/input`、`/output`，因此 MIMO 2.5 等严格校验模型会拒绝 `/api/shared-resources/.../content` 之类的 URL。
3. Admin 性能改造加入了 1-5 秒读缓存，但写操作后没有对应的缓存失效。写入虽然成功，紧接着的重新读取仍可能命中旧快照；很多编辑页又没有自动轮询，因此必须刷新浏览器才能看到结果。

## 2. 已确认的产品行为

### 2.1 LLM 请求无上下文

- 每次 LLM 节点执行只发送：系统提示词、当前用户文本、当前轮图片、当前轮视频及当前模型参数。
- 不发送任何历史用户消息、历史助手回复、历史图片或历史视频。
- 旧画布已经保存的 `history` 只作为界面记录，不得进入新的 Provider 请求。
- 当前回复仍写入 `reply` 和 `prompt`，继续作为下游文本输出；本轮不改变节点间输出契约。
- “新会话”继续清空节点内保存的历史记录，但清空与否不影响请求上下文，因为请求始终无历史。

### 2.2 历史会话开关

- 现有参数行第三列的“流式”开关改为“历史会话”。
- 新字段为 `showHistory: boolean`，默认 `false`。
- 关闭时，右侧面板只显示最近一次用户输入以及其后的本次助手结果。
- 打开时，右侧面板显示节点保存的全部历史。
- 开关只控制展示，不改变请求负载。
- 旧画布没有 `showHistory` 时按 `false` 处理，不执行数据迁移写回。
- 流式传输不再由用户开关控制：支持 SSE 的内置文本模型自动流式；后台发布模型、扩展 Provider、图片输出和视频输入继续采用当前非流式路径。

### 2.3 Admin 刷新语义

- 当前浏览器完成写入后，页面必须在该写请求成功后立即显示服务器返回的新状态，不需要整页刷新。
- 写入后只失效受影响的数据域，不允许通过清空全部 Admin 缓存恢复正确性。
- 后台重新拉取必须使用服务器权威值完成二次校准，不能长期只依赖乐观更新。
- 其他管理员或其他浏览器产生的变更应在 1-3 秒内被当前后台感知。
- 有未保存草稿的编辑器不得被远端更新静默覆盖；应显示“后台数据已更新”的受控提示。
- 只读列表和没有草稿的页面可以自动刷新。

## 3. 全局可移植性约束

### 3.1 必须长期保存相对逻辑引用

以下位置只能保存相对引用或资源 ID：

- Canvas Project 节点数据
- LLM 节点 `history`
- Generation Artifact / Resource Asset 元数据
- 公共工作流 JSON
- 数据库素材记录
- Admin 配置和发布记录中的业务数据

禁止持久化：

- `zezhen.xyz`、旧域名或其他具体主机名
- 服务器 IP
- Windows 盘符路径
- Linux `/opt/...` 绝对路径
- 已签名且会过期的 Provider 下载 URL

允许长期保存的示例：

```text
/files/input/example.png
/files/output/result.png
/api/shared-resources/items/shared-id/content
/api/materials/generation-library/artifact-id/content
```

### 3.2 绝对 URL 只在 Provider 请求边界生成

数据流固定为：

```text
相对逻辑引用
→ 识别引用类型
→ 校验当前用户权限和资源归属
→ 生成短时相对签名路径
→ 使用当前请求环境的 publicOrigin 拼成绝对 HTTPS URL
→ 仅写入本次 Provider 请求体
```

`publicOrigin` 必须来自当前运行环境配置或请求上下文，例如现有 `providerFilePublicOrigin(request)`，不得在代码中写死域名。

同一份画布数据部署到服务器 A 与服务器 B 时，只应在请求发送瞬间分别得到服务器 A 或 B 的绝对地址；持久化数据本身必须完全相同。

### 3.3 “相对路径”的精确定义

本文所称相对路径是**相对于当前站点根目录的逻辑 URI**，不是相对于 Node.js `process.cwd()`、源码目录或服务器磁盘目录的文件路径。

- 合法逻辑引用必须以 `/` 开头，例如 `/files/input/a.png` 或 `/api/shared-resources/items/id/content`。
- 禁止保存 `./uploads/a.png`、`../shared/a.png`、`file://...`、盘符路径或 `/opt/...` 之类依赖机器目录结构的值。
- API repository 根据当前环境配置的数据根目录解析逻辑资源 ID；逻辑 URI 本身不得参与磁盘路径拼接。
- 文件读取前必须执行归属、生命周期、类型和路径穿越校验，不能仅依靠 `basename()` 抹平非法输入。
- 服务器迁移只迁移数据库、资源文件和环境配置，不需要批量改写 Canvas JSON 或历史记录中的素材地址。

### 3.4 publicOrigin 解析优先级

Provider 最终需要绝对 HTTPS URL，但 origin 仍不能写死：

1. Gray / Production 必须优先读取 `XINGHUAN_PROVIDER_FILE_PUBLIC_ORIGIN`，并要求其为合法 HTTPS origin。
2. Local 开发允许在没有配置时回退到受信反向代理头或当前请求 origin。
3. Gray / Production 不得无条件相信任意客户端传入的 `Host`、`X-Forwarded-Host` 或 `X-Forwarded-Proto`。
4. 同域绝对 URL 的判断使用本次已经解析并校验过的 `publicOrigin`；不能通过字符串包含关系判断同域。

因此部署到另一台服务器时只需修改环境变量和代理配置，不修改源码、数据库业务记录或画布 JSON。

## 4. LLM 会话设计

### 4.1 请求构造

从 `LLMNode.tsx` 抽出纯函数，避免继续把请求协议堆进热点组件：

```ts
export interface StatelessLlmMessageInput {
  systemPrompt: string;
  userText: string;
  imageUrls: string[];
  videoUrls: string[];
}

export function buildStatelessLlmMessages(input: StatelessLlmMessageInput): LlmMessage[];
```

函数不得接受 `history` 参数。类型层面禁止调用方误把历史传入。

### 4.2 展示投影

历史展示使用独立纯函数：

```ts
export function visibleLlmConversationTurns(
  history: ChatTurn[],
  showHistory: boolean,
): Array<{ turn: ChatTurn; historyIndex: number }>;
```

- `showHistory=true` 返回全部记录及原索引。
- `showHistory=false` 从最后一个 `role=user` 开始返回，通常为最后一组用户/助手消息。
- 保留原索引，确保双击编辑助手回复时修改正确的历史项。
- 流式中的临时文字继续作为当前轮投影显示，不提前写入已完成历史。

### 4.3 流式自动策略

保留当前运行能力，但移除参数开关：

```ts
const shouldStream = !isImageOutput
  && !isBackendSelected
  && !isExternalSelected
  && userVideos.length === 0;
```

旧字段 `stream` 只做读取兼容，不再作为 UI 配置继续传播；新节点默认数据不再写入 `stream: true`。在后续独立清理前，不主动重写旧画布。

## 5. Provider 媒体引用设计

### 5.1 统一解析器

API 新增唯一的多模态媒体解析边界：

```ts
export type ProviderMediaKind = "image" | "video";

export interface ProviderMediaResolveInput {
  reference: string;
  kind: ProviderMediaKind;
  actor: { id: string };
  environment: "local" | "gray" | "production";
  publicOrigin: string;
}

export interface ProviderMediaResolveResult {
  value: string;
  transport: "data-url" | "external-url" | "signed-url";
  sourceType: "inline" | "external" | "user-file" | "shared-resource" | "generation-artifact";
}
```

解析顺序：

1. 合法且受大小限制的 `data:image/...;base64` 原样返回。
2. 外部 `https://` 地址原样返回；`http://` 是否允许沿用 Provider 现有策略，但不得将内部主机误判为外部地址。
3. 当前环境同域绝对 URL 先还原成相对路径，再进入站内引用解析。
4. `/files`、`/input`、`/output` 解析为当前用户文件。
5. `/api/shared-resources/items/:id/content` 解析为公共资源 ID，并重新校验该用户的查看/使用权限。
6. `/api/materials/generation-library/:id/content` 解析为当前用户的生成产物 ID，并校验 owner 与生命周期状态。
7. 未知相对路径直接返回平台错误，不得继续传给 Provider。

`./`、`../`、`file://`、Windows 盘符和服务器绝对目录不属于支持的内部引用，必须在分类阶段拒绝。

### 5.2 通用短时签名入口

新增相对入口：

```text
/api/provider-media/{token}
```

Token 只包含或签名以下逻辑信息：

- schema version
- environment scope
- actor ID
- source type
- source ID 或相对逻辑引用
- expiry

Token 不包含绝对文件路径、域名、IP 或明文密钥。入口校验签名和有效期后，由服务端根据当前环境的数据目录和 repository 解析实际文件。

绝对地址只在本次 Provider 请求中通过以下方式生成：

```ts
new URL(relativeSignedPath, publicOrigin).toString();
```

### 5.3 错误语义

在调用 Provider 前返回明确错误：

- `LLM_MEDIA_REFERENCE_UNSUPPORTED`
- `LLM_MEDIA_REFERENCE_FORBIDDEN`
- `LLM_MEDIA_REFERENCE_NOT_FOUND`
- `LLM_MEDIA_DATA_URL_TOO_LARGE`
- `LLM_MEDIA_KIND_MISMATCH`
- `LLM_MEDIA_PUBLIC_ORIGIN_INVALID`

前端提示必须指出第几个素材和来源节点，不再只显示 MIMO 的 `Param Incorrect`。

## 6. Admin 同浏览器新鲜度设计

### 6.1 当前错误流程

```text
POST/PATCH/PUT/DELETE 成功
→ loadWorkspaceData()
→ readAdminQuery() 命中旧 value
→ React 重新设置旧快照
→ 页面没有后续刷新触发
```

### 6.2 Query Key 注册表

建立集中注册表，不允许各页面拼写散落的字符串：

```ts
export const adminQueryKeys = {
  shell: ["shell"] as const,
  providers: ["providers"] as const,
  models: ["models"] as const,
  directory: ["directory"] as const,
  tasks: ["tasks"] as const,
  announcements: ["content", "announcements"] as const,
  audit: ["analytics", "audit"] as const,
  system: ["system"] as const,
};
```

### 6.3 写入失效映射

所有 Admin 写请求通过纯函数映射受影响数据域。示例：

```text
/api/admin/providers/*          → providers, models, shell
/api/admin/models/*             → models, providers, shell
/api/admin/users/*              → directory, shell
/api/admin/user-groups/*        → directory, shell
/api/admin/permission-*         → directory, permissions, shell
/api/admin/runninghub/*         → runninghub, providers, permissions
/api/shared-resources/*         → shared-resources, permissions
/api/admin/announcements/*      → announcements, shell
/api/admin/system-settings/*    → system, shell
/api/admin/tasks/*              → tasks, shell
```

成功写入后按以下顺序处理：

1. 使用响应实体立即更新当前编辑器或列表。
2. 失效映射中的 query key。
3. 对当前页面执行 `force: true` 的权威重读。
4. 权威重读失败时保留成功写入结果，并显示“已保存，状态校准失败，可重试”，不得把旧缓存恢复回来。

### 6.4 手动刷新

所有用户主动点击的“刷新”必须强制绕过缓存。路由切换和短时间返回上一页仍可使用缓存，以继续保留性能收益。

## 7. Admin 跨浏览器新鲜度设计

### 7.1 数据域 revision

新增 `xh_admin_change_revisions`：

```sql
domain text primary key,
revision bigint not null,
updated_at timestamptz not null,
updated_by text
```

每次成功写入后，只递增受影响数据域的 revision。revision 不承载业务数据，不替代各业务对象自己的 revision。

开发文件模式使用相同接口的进程内实现；重启后从 1 开始不影响正确性，因为客户端重连会执行完整当前页面校准。

### 7.2 单一 Admin 事件流

新增管理员专用事件流：

```text
GET /api/admin/changes/stream
```

事件只包含：

```json
{
  "domain": "models",
  "revision": 42,
  "updatedAt": 1786350000000
}
```

- 只允许已认证管理员连接。
- 不发送业务记录、密钥、用户数据或审计正文。
- 同一 Admin 页面只建立一个连接。
- 断线采用退避重连；窗口重新可见时执行 revision 快照校验。

### 7.3 草稿保护

- 没有未保存草稿：收到事件后失效对应 key，并强制刷新当前受影响视图。
- 有未保存草稿：保留草稿，显示“后台数据已更新”；用户可以重新加载服务器版本或继续保存并接受现有 revision 冲突检查。
- 账号停用、会话撤销、权限收紧等安全事件不得被草稿保护延迟；应立即重新验证当前会话与权限。

## 8. 处理后的用户效果

### LLM 节点

- 默认只显示本次用户输入与本次模型结果。
- 打开“历史会话”后可以回看旧结果，但旧结果绝不影响新执行。
- 不同轮次可以使用不同图片，不会因旧轮图片 URL 过期导致后续请求失败。
- 公共资源、生成库和共享工作流图片可在不同服务器和域名环境中继续用于 MIMO 等严格多模态模型。

### Admin

- 当前管理员保存后立即看到新值，不刷新浏览器。
- 同一页面不会在保存成功后闪回旧值。
- 其他管理员的改动在 1-3 秒内出现或触发受控更新提示。
- 有草稿时不会被远端数据覆盖。
- 只刷新受影响数据域，不恢复性能改造前的全量请求。
- 页面切换仍可复用短时缓存，用户主动刷新和写后校准始终读取权威数据。

## 9. 验收标准

### LLM

- 给定三轮历史，请求体中只存在系统消息和当前用户消息。
- `showHistory=false` 只展示最后一轮；`true` 展示全部历史。
- 旧 `history` 含非法相对媒体 URL 时，新请求仍不包含该历史。
- MIMO 图片请求不再包含裸 `/api/...` 相对 URL。
- 同一相对素材引用在两个不同 `publicOrigin` 下生成各自正确的绝对签名地址。
- Canvas JSON、数据库和 history 中不存在本次生成的绝对签名地址。
- Gray / Production 缺少或配置了非 HTTPS `publicOrigin` 时，在 Provider 请求前失败，不回退到未受信 Host 头。
- `./`、`../`、`file://`、盘符路径和服务器绝对路径均不能进入 Provider 请求或持久化数据。

### Admin

- 每类写操作成功后，当前页面不刷新即可显示新值。
- 写后重读不会命中失效前的缓存值。
- 手动刷新一定发起网络请求。
- Provider 修改不会触发任务、审计、资源库等无关全量重读。
- 远端变更在 3 秒内触发当前页面更新或草稿保护提示。
- 事件流不暴露业务数据和密钥。
- 会话撤销和权限收紧能够立即生效。

## 10. 非目标

- 不把 LLM 节点改造成 AI 助手会话。
- 不删除历史记录编辑、清空、拖拽和文本打散能力。
- 不迁移到 TanStack Query 或其他新的前端数据框架。
- 不通过清空全部缓存解决写后旧值。
- 不在本轮改变 Generation Artifact、Resource Asset 或公共资源的领域生命周期。
- 不在设计阶段执行服务器部署、数据迁移或 Production 晋级。

## 11. 停止条件

- 任何实现需要把域名、IP、绝对磁盘路径或过期签名 URL写入画布/数据库。
- Provider 媒体入口可以绕过用户 owner、公共资源权限或生命周期校验。
- Admin 缓存失效造成跨用户、跨管理员等级或跨环境数据复用。
- 远端更新会静默覆盖未保存草稿。
- 为实现刷新而恢复全量后台读取或产生请求风暴。
- 实施时 canonical state、服务器版本或分支状态与本文前提不一致。
