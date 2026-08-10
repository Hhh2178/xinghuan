# LLM 无上下文、可移植媒体与后台新鲜度实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 LLM 节点每次独立执行、以可移植相对引用安全地向多模态 Provider 提供媒体，并让 Admin 写入结果在当前浏览器及其他管理员会话中及时且受控地刷新。

**Architecture:** 四个批次依次建立无上下文会话投影、Provider 媒体解析与短时签名边界、Admin 同浏览器缓存失效、Admin 跨浏览器 revision 事件流。长期数据只保存相对逻辑引用，绝对 Provider URL 只在请求发送瞬间依据当前环境生成。

**Tech Stack:** React 19、TypeScript、Vitest、Node HTTP API、PostgreSQL、SSE、HMAC 签名、现有 Admin query cache 与 release Harness。

## 全局约束

- Canvas、history、数据库和公共工作流只能持久化相对引用或资源 ID。
- “相对引用”指以 `/` 开头的站内逻辑 URI，不是相对于源码、`process.cwd()` 或服务器数据目录的磁盘路径。
- 禁止把域名、IP、Windows/Linux 绝对路径或过期签名 URL 写入业务数据。
- Gray / Production 的 Provider public origin 必须来自合法 HTTPS 环境配置；只有 Local 允许回退到受信请求 origin。
- LLM 请求永远不携带历史轮次，`showHistory` 只控制展示。
- Admin 写后只失效相关 query key，不清空全部缓存。
- 有未保存草稿时，远端更新不得静默覆盖本地输入。
- owner、权限、管理员等级、环境和资源生命周期校验不得因签名媒体入口或缓存而放宽。
- 每个批次独立测试、独立提交；达到 Gray 发布级别时按执行时的当前版本只递增 PATCH。
- 未获得新的部署授权前，只执行本地实现与验证，不修改 Gray、Production、服务器数据或 release-state。

---

## 四批次交付总览

| 批次 | 进入条件 | 核心交付物 | 退出条件 | 独立回滚点 |
| --- | --- | --- | --- | --- |
| Batch 1 | 当前 LLM 行为测试基线可运行 | 无上下文请求构造、`历史会话` 展示开关、自动流式策略 | 请求体无历史；默认只显示本轮；Web type-check/build 通过 | 恢复节点请求/展示提交，不涉及 API 或数据库 |
| Batch 2 | Batch 1 已固定“仅当前轮”协议 | 逻辑 URI 解析器、运行时 origin 策略、短时签名媒体入口、MIMO 回归 | MIMO 仅收到有效 HTTPS/data URL；持久化数据仍为相对引用 | 回滚媒体 resolver 和 route；旧 provider-files 能力保持兼容 |
| Batch 3 | Admin 缓存基线和 mutation 路由矩阵已冻结 | 统一数据域分类、精准 query 失效、写后强制权威重读 | 当前浏览器写后立即显示新值；无关缓存不刷新 | 回滚 Admin 客户端提交，不涉及数据库迁移 |
| Batch 4 | Batch 3 已保证本地写后正确 | revision 表、认证 SSE、跨浏览器刷新、草稿保护、全量验收 | 远端变更 3 秒内可见或提示；无请求风暴；全矩阵通过 | 先关闭 SSE 消费，再回滚 API；revision 表可保留且不影响旧版本 |

批次必须按顺序实施。Batch 1 与 Batch 2 共享 LLM 请求协议；Batch 3 先修复当前浏览器的确定性错误，Batch 4 才增加跨浏览器同步，避免用实时通道掩盖本地缓存失效缺陷。

---

## 文件结构

### Batch 1: LLM 无上下文与历史展示

- Create: `apps/web/src/components/nodes/llm-conversation-state.ts` - 纯请求构造和历史展示投影。
- Create: `apps/web/src/components/nodes/llm-conversation-state.test.ts` - 无上下文、最后一轮和原索引回归。
- Modify: `apps/web/src/components/nodes/LLMNode.tsx` - 接入纯函数、替换开关、自动选择流式。
- Modify: `apps/web/src/components/Canvas.tsx` - 新节点默认 `showHistory: false`，停止写入新的 `stream: true`。
- Modify: `apps/web/src/types/canvas.ts` - 声明 LLM 节点的可选展示字段。
- Modify: `scripts/verify-llm-media-capability-contract.ts` - 增加无历史请求和历史开关静态契约。

### Batch 2: 可移植 Provider 媒体引用

- Create: `apps/api/src/provider-media-reference.ts` - 分类相对/同域/外部/data URL 并生成本次请求值。
- Create: `apps/api/src/provider-media-reference.test.ts` - 可移植性、权限错误和不同 publicOrigin 回归。
- Create: `apps/api/src/provider-public-origin.ts` - 环境配置优先、Local 受信请求回退的 origin 解析。
- Create: `apps/api/src/provider-public-origin.test.ts` - HTTPS、环境范围和伪造 Host/forwarded header 回归。
- Create: `apps/api/src/provider-media-access.ts` - 通用短时 token 的签名、验证和 claim 类型。
- Create: `apps/api/src/provider-media-access.test.ts` - 过期、篡改、scope 和无绝对路径测试。
- Create: `apps/api/src/provider-media-routes.ts` - `/api/provider-media/:token` 读取入口。
- Create: `apps/api/src/provider-media-routes.test.ts` - 匿名 token 读取、权限与文件不存在回归。
- Modify: `apps/api/src/external-proxy.ts` - 异步规范化所有当前轮多模态 part。
- Modify: `apps/api/src/external-proxy-types.ts` - 注入媒体 resolver 接口。
- Modify: `apps/api/src/server.ts` - 组装 resolver、资源 repository 与 provider-media route。
- Modify: `apps/api/src/shared-resource-routes.ts` - 暴露按资源 ID 解析共享资产的内部能力，不返回绝对路径。
- Modify: `apps/api/src/generation-artifact-routes.ts` - 复用 owner-scoped 产物解析能力。
- Modify: `apps/api/src/provider-file-access.ts` - 保留旧文件签名兼容，并与通用媒体 claim 共用 scope 规则。
- Modify: `config/canvas-next.env.example` - 说明运行时 public origin，不写具体部署域名。
- Modify: `config/canvas-production.env.example` - 同上。
- Modify: `config/.env.example` - 说明 Local 回退与服务器环境强制配置规则。

### Batch 3: Admin 同浏览器写后新鲜度

- Create: `packages/shared/src/admin-change-domains.ts` - method/path 到稳定 Admin change domain 的跨端分类。
- Create: `packages/shared/src/admin-change-domains.test.ts` - Provider、模型、账号、权限、RH、资源、任务、系统等完整矩阵。
- Modify: `packages/shared/src/index.ts` - 导出 Admin change domain 类型与分类器，供 API 和 Admin 共用。
- Create: `apps/admin/src/admin-query-keys.ts` - query key 单一注册表。
- Create: `apps/admin/src/admin-mutation-invalidation.ts` - change domain 到 query prefix 的纯映射。
- Create: `apps/admin/src/admin-mutation-invalidation.test.ts` - 各业务域失效矩阵。
- Modify: `apps/admin/src/admin-query-client.ts` - 批量失效和强制读取接口。
- Modify: `apps/admin/src/admin-query-client.test.ts` - 写后失效、强制读取和无关 key 保留。
- Modify: `apps/admin/src/admin-data-loaders.ts` - 增加 `{ force?: boolean }`。
- Modify: `apps/admin/src/admin-data-loaders.test.ts` - 手动刷新与写后重读绕过缓存。
- Modify: `apps/admin/src/admin-api-client.ts` - 非 GET 成功后执行精准失效；直传上传补齐失效。
- Modify: `apps/admin/src/main.tsx` - mutation 后强制校准当前 workspace，不允许旧缓存覆盖。
- Modify: `apps/admin/src/admin-api-client.ts` 的 `/api/files/upload` 直传分支 - 成功后接入同一数据域失效入口；只读 ETag 和 assistant stream 不触发 mutation 失效。

### Batch 4: Admin 跨浏览器 revision 与事件流

- Create: `apps/api/db/050_admin_change_revisions.sql` - 数据域 revision 表。
- Create: `apps/api/src/admin-change-repository.ts` - read/touch revision 接口与文件模式兼容。
- Create: `apps/api/src/admin-change-repository.test.ts` - 原子递增和多域更新。
- Create: `apps/api/src/admin-change-stream.ts` - 单进程共享轻量轮询与 SSE 广播。
- Create: `apps/api/src/admin-change-stream.test.ts` - 认证、重连、去重和事件最小化。
- Create: `apps/api/src/admin-change-routes.ts` - snapshot 和 `/api/admin/changes/stream`。
- Create: `apps/admin/src/use-admin-change-stream.ts` - 单连接、退避、visibility 校准。
- Create: `apps/admin/src/use-admin-change-stream.test.ts` - 事件失效、断线和草稿保护。
- Create: `apps/admin/src/admin-freshness-state.ts` - dirty domain 与远端更新提示状态。
- Modify: `apps/api/src/server.ts` - 注册 change repository/routes，并在成功 mutation 后 touch domains。
- Modify: `apps/admin/src/main.tsx` - 将事件映射到 query invalidation、force refresh 或 guarded notice。
- Modify: `apps/admin/src/admin-view-model.ts` - 明确 live/manual/guarded 的事件刷新语义。
- Modify: `docs/systems/api/interface-map.md`、`docs/systems/admin/protocol-and-capabilities.md`、`docs/systems/auth-and-users/session-and-csrf.md` - 记录新协议与安全边界。

---

## Batch 1: LLM 无上下文请求与历史会话开关

### Task 1.1: 建立可测试的会话纯函数

**Interfaces:**

```ts
export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  images?: string[];
  videos?: string[];
};

export function buildStatelessLlmMessages(input: {
  systemPrompt: string;
  userText: string;
  imageUrls: string[];
  videoUrls: string[];
}): LlmMessage[];

export function visibleLlmConversationTurns(
  history: ChatTurn[],
  showHistory: boolean,
): Array<{ turn: ChatTurn; historyIndex: number }>;
```

- [ ] **Step 1: Write failing tests for stateless messages**

  Tests must provide two previous user/assistant pairs plus a current text/image request and assert that the result contains only optional system plus one current user message.

- [ ] **Step 2: Run the focused RED test**

  Run: `npx vitest run apps/web/src/components/nodes/llm-conversation-state.test.ts`

  Expected: FAIL because the module and functions do not exist.

- [ ] **Step 3: Implement the pure module**

  Build multimodal content only when the current input contains image or video values. Do not accept history as an input to `buildStatelessLlmMessages`.

- [ ] **Step 4: Add display projection tests**

  Cover full history, default-last-turn behavior, incomplete last user turn, assistant-only legacy data, and preservation of original indexes.

- [ ] **Step 5: Run focused GREEN tests**

  Run: `npx vitest run apps/web/src/components/nodes/llm-conversation-state.test.ts`

  Expected: PASS.

### Task 1.2: Integrate LLMNode behavior and presentation

- [ ] **Step 1: Replace the request builder**

  Remove the `history.forEach()` request construction from `LLMNode.tsx`; call `buildStatelessLlmMessages` with current values only.

- [ ] **Step 2: Replace the third parameter control**

  Render label `历史会话`, bind checkbox to `d.showHistory === true`, show `开` or `关`, and keep the existing stable three-column dimensions.

- [ ] **Step 3: Replace history rendering input**

  Iterate `visibleLlmConversationTurns(history, showHistory)` and pass `historyIndex` to edit handlers so collapsed display edits the correct stored assistant turn.

- [ ] **Step 4: Make streaming automatic**

  Derive one `shouldStream` boolean from model path and current media. Use it for request selection, stop button, logging and streaming indicator. Do not read the new history switch for transport behavior.

- [ ] **Step 5: Update new-node defaults and compatibility**

  New nodes receive `showHistory: false`; legacy `stream` and absent `showHistory` remain readable without migration writes.

- [ ] **Step 6: Add presentation contract assertions**

  Update `verify-llm-media-capability-contract.ts` to fail if the UI still labels the third control as `流式`, if `history.forEach` participates in request construction, or if the history field defaults on.

- [ ] **Step 7: Run Batch 1 verification**

  Run:

  ```text
  npx vitest run apps/web/src/components/nodes/llm-conversation-state.test.ts
  npx vitest run apps/web/src/components/nodes/GenerationNodes.presentation.test.ts
  npm run verify:llm-media-capability-contract
  npm run type-check -w @xinghuan/web
  ```

- [ ] **Step 8: Commit Batch 1**

  Commit: `fix(llm): make node requests stateless`

### Batch 1 acceptance

- Existing history is visible only when requested.
- Default view displays the latest turn only.
- Provider payload contains zero historical turns.
- Streaming still works automatically for supported local text models.
- No server or database change is required.

---

## Batch 2: MIMO 与 Provider 可移植媒体引用

### Task 2.1: Define token claims and signing boundary

**Interfaces:**

```ts
export type ProviderMediaSourceType = "user-file" | "shared-resource" | "generation-artifact";

export interface ProviderMediaClaim {
  version: 1;
  scope: "local" | "gray" | "production";
  actorId: string;
  sourceType: ProviderMediaSourceType;
  sourceId: string;
  expiresAt: number;
}

export function signProviderMediaClaim(claim: ProviderMediaClaim, secret: Buffer): string;
export function verifyProviderMediaToken(token: string, secret: Buffer, now?: number): ProviderMediaClaim | null;
```

- [ ] **Step 1: Write token RED tests**

  Assert valid round-trip, expiry rejection, signature tampering rejection, scope preservation, and absence of `http`, drive letters and `/opt/` in decoded claims.

- [ ] **Step 2: Implement compact HMAC token signing**

  Use base64url JSON plus HMAC-SHA256. Limit source IDs and actor IDs before signing; use constant-time signature comparison.

- [ ] **Step 3: Run token GREEN tests**

  Run: `npx vitest run apps/api/src/provider-media-access.test.ts`

### Task 2.2: Implement relative reference resolver

**Interfaces:**

```ts
export interface ProviderMediaResolverDependencies {
  signClaim(claim: ProviderMediaClaim): string;
  authorizeSharedResource(actorId: string, itemId: string): Promise<boolean>;
  authorizeGenerationArtifact(actorId: string, artifactId: string): Promise<boolean>;
}

export function createProviderMediaReferenceResolver(
  deps: ProviderMediaResolverDependencies,
): (input: ProviderMediaResolveInput) => Promise<ProviderMediaResolveResult>;
```

- [ ] **Step 1: Write public-origin RED tests**

  Cover configured HTTPS origin, trailing slash normalization, Gray/Production missing configuration, non-HTTPS server configuration, Local trusted request fallback, and hostile `Host`/forwarded headers. Gray/Production must fail closed instead of generating an attacker-controlled URL.

- [ ] **Step 2: Extract and implement public-origin resolution**

  Move the policy out of the `server.ts` hotspot into `provider-public-origin.ts`. Return one normalized origin without path, query or fragment. Do not persist the result.

- [ ] **Step 3: Run public-origin GREEN tests**

  Run: `npx vitest run apps/api/src/provider-public-origin.test.ts`

- [ ] **Step 4: Write classification RED tests**

  Cover data URL, external HTTPS, current-origin absolute URL, `/files`, `/input`, `/output`, shared-resource content, generation-library content and unknown relative paths. Explicitly reject `./`, `../`, `file://`, Windows drive paths and server absolute paths that are not registered logical URI patterns.

- [ ] **Step 5: Write portability RED test**

  Resolve the same stored relative reference with `https://server-a.example` and `https://server-b.example`; assert only the returned outgoing URL origin differs and the source reference remains unchanged.

- [ ] **Step 6: Implement classification and authorization**

  Convert current-origin absolute URLs back to pathname before matching. Generate a relative `/api/provider-media/{token}` path, then use `new URL(relativePath, publicOrigin)` only for the returned outgoing value.

- [ ] **Step 7: Add explicit error objects**

  Return typed errors for unsupported, forbidden, missing, oversize, kind mismatch and invalid public origin conditions. Do not silently pass unknown `/api/...` values.

- [ ] **Step 8: Run resolver GREEN tests**

  Run:

  ```text
  npx vitest run apps/api/src/provider-public-origin.test.ts
  npx vitest run apps/api/src/provider-media-reference.test.ts
  ```

### Task 2.3: Add signed media route and repository resolution

- [ ] **Step 1: Write route RED tests**

  Verify a valid token streams the matching user file/shared asset/generation artifact, an expired token returns 403, a missing source returns 404, and no browser Cookie is required after token validation.

- [ ] **Step 2: Implement source resolution without absolute claims**

  Resolve `sourceType + sourceId` through current environment repositories and data directories after token verification. Reject any decoded source that attempts path traversal.

- [ ] **Step 3: Preserve existing owner and permission checks**

  Shared resources must pass published/permission checks at token creation. Generation artifacts must match actor owner and active lifecycle state. User files must stay inside the actor's input/output directories.

- [ ] **Step 4: Register the route and files-domain forwarding contract**

  Register `/api/provider-media/:token` in API routing. Update the tracked Nginx/runbook template only if the current files-domain proxy does not already forward `/api/*` to the selected environment.

- [ ] **Step 5: Run route GREEN tests**

  Run: `npx vitest run apps/api/src/provider-media-routes.test.ts`

### Task 2.4: Integrate external LLM chat normalization

- [ ] **Step 1: Make chat message normalization async**

  Resolve every current `image_url.url` and supported video part before `fetch(chat/completions)`. Keep text unchanged.

- [ ] **Step 2: Preserve stateless boundary**

  Normalize only messages received from Batch 1. Do not reintroduce history inside API normalization.

- [ ] **Step 3: Add MIMO fixture regression**

  Given `/api/shared-resources/items/shared-1/content`, assert the upstream payload contains an HTTPS signed URL and never contains the naked relative reference.

- [ ] **Step 4: Add failure diagnostic projection**

  Return the platform media error code and material index to the web node before an upstream request is attempted.

- [ ] **Step 5: Run Batch 2 verification**

  Run:

  ```text
  npx vitest run apps/api/src/provider-public-origin.test.ts
  npx vitest run apps/api/src/provider-media-access.test.ts
  npx vitest run apps/api/src/provider-media-reference.test.ts
  npx vitest run apps/api/src/provider-media-routes.test.ts
  npx vitest run apps/api/src/shared-resource-routes.test.ts
  npm run build -w @xinghuan/api
  npm run type-check -w @xinghuan/api
  ```

- [ ] **Step 6: Commit Batch 2**

  Commit: `fix(llm): resolve portable provider media references`

### Batch 2 acceptance

- MIMO receives only data URLs or valid runtime HTTPS URLs.
- Shared and generation references remain relative in persisted data.
- Server/domain changes require only environment configuration, not data rewrite.
- Invalid internal references fail before Provider billing or upstream submission.
- Signed access cannot escape owner, permission, scope or expiry boundaries.

---

## Batch 3: Admin 同浏览器写后缓存失效

### Task 3.1: Centralize query keys and invalidation matrix

**Interfaces:**

```ts
export type AdminChangeDomain =
  | "shell" | "providers" | "models" | "directory" | "permissions"
  | "runninghub" | "shared-resources" | "announcements"
  | "tasks" | "audit" | "system";

export function adminChangeDomainsForMutation(input: {
  method: string;
  pathname: string;
}): AdminChangeDomain[];

export type AdminQueryPrefix = readonly unknown[];

export function adminQueryPrefixesForDomains(
  domains: AdminChangeDomain[],
): AdminQueryPrefix[];
```

- [ ] **Step 1: Write the shared mutation-domain RED matrix**

  Include Provider, model, account, group, session, permission, RH, public resource, announcement, task and system settings writes. Normalize query strings away and assert GET/HEAD return no change domains.

- [ ] **Step 2: Implement and export shared domain classification**

  Add `admin-change-domains.ts` to `@xinghuan/shared` exports. Use explicit method/path patterns rather than one broad `/api/admin/*` rule, so API revision events and Admin cache invalidation share the same vocabulary.

- [ ] **Step 3: Write Admin domain-to-query RED tests**

  Assert each domain maps only to its registered query prefixes. In particular, Provider/model changes may refresh `shell` but must not clear tasks, audit, accounts or resources; security domains must include the current authorization/shell projections.

- [ ] **Step 4: Implement query key constants and domain mapping**

  Centralize all existing loader keys in `admin-query-keys.ts`, then implement `adminQueryPrefixesForDomains()`. The Admin client composes shared route classification with this local query mapping.

- [ ] **Step 5: Run matrix GREEN tests**

  Run:

  ```text
  npx vitest run packages/shared/src/admin-change-domains.test.ts
  npx vitest run apps/admin/src/admin-mutation-invalidation.test.ts
  npm run type-check -w @xinghuan/shared
  ```

### Task 3.2: Propagate existing force-read and add batch invalidation

- [ ] **Step 1: Add query-client regression tests**

  The query client already supports `force`; freeze that behavior with tests. Assert invalidated keys reload immediately inside max age, unrelated keys remain cached, and `force: true` replaces an in-flight or settled cached value with the authoritative result.

- [ ] **Step 2: Implement batch invalidation**

  Add `invalidateAdminQueryPrefixes(prefixes)` and keep `invalidateAdminQueries(prefix)` as the primitive.

- [ ] **Step 3: Add loader force option**

  Introduce `AdminSnapshotReadOptions { force?: boolean }` and pass it into every `readAdminQuery` call used by the selected workspace.

- [ ] **Step 4: Run query and loader tests**

  Run:

  ```text
  npx vitest run apps/admin/src/admin-query-client.test.ts
  npx vitest run apps/admin/src/admin-data-loaders.test.ts
  ```

### Task 3.3: Wire all successful mutations

- [ ] **Step 1: Invalidate in the shared API client**

  After a successful non-GET response, derive affected prefixes and invalidate them before returning the response data. Do not invalidate failed writes.

- [ ] **Step 2: Cover direct-fetch exceptions**

  The `/api/files/upload` direct-fetch branch explicitly invokes the same success handler. The channel-health ETag read and assistant chat stream are classified as non-state reads/streams and must not invalidate Admin queries.

- [ ] **Step 3: Force current workspace reconciliation**

  Change `main.tsx` mutation completion to call `loadWorkspaceData(activeWorkspaceId, { force: true })`. A failed reconciliation must not replace the successful mutation result with old state.

- [ ] **Step 4: Make manual refresh authoritative**

  Every visible Admin refresh command passes `force: true`; route mount keeps normal cached reads.

- [ ] **Step 5: Add current-browser integration tests**

  Simulate a cached Provider list, successful Provider update, immediate workspace reload and assert the second GET result is rendered without `window.location.reload()`.

- [ ] **Step 6: Run Batch 3 verification**

  Run:

  ```text
  npx vitest run packages/shared/src/admin-change-domains.test.ts
  npx vitest run apps/admin/src/admin-mutation-invalidation.test.ts
  npx vitest run apps/admin/src/admin-query-client.test.ts
  npx vitest run apps/admin/src/admin-data-loaders.test.ts
  npm run type-check -w @xinghuan/admin
  npm run build -w @xinghuan/admin
  ```

- [ ] **Step 7: Commit Batch 3**

  Commit: `fix(admin): invalidate cached reads after mutations`

### Batch 3 acceptance

- Every covered mutation shows the new server value without browser refresh.
- No successful write is followed by restoration of a stale cached snapshot.
- Unrelated data domains do not refetch.
- Route navigation still benefits from short-lived cache.
- Manual refresh always reaches the API.

---

## Batch 4: Admin 跨浏览器 revision、事件流与完整验收

### Task 4.1: Persist domain revisions

**Interfaces:**

```ts
import type { AdminChangeDomain } from "@xinghuan/shared";

export interface AdminChangeRevision {
  domain: AdminChangeDomain;
  revision: number;
  updatedAt: number;
}

export interface AdminChangeRepository {
  readAll(): Promise<AdminChangeRevision[]>;
  touch(domains: AdminChangeDomain[], actorId: string): Promise<AdminChangeRevision[]>;
}
```

- [ ] **Step 1: Write migration contract test**

  Assert primary key domain, positive bigint revision, updated timestamp and optional actor audit column.

- [ ] **Step 2: Implement PostgreSQL atomic upsert**

  Increment each domain with `insert ... on conflict ... revision = revision + 1 returning ...` inside one transaction per mutation completion.

- [ ] **Step 3: Implement development fallback**

  Provide the same repository interface in file/in-memory mode without hardcoded paths; restart may reset revisions but must trigger a full client snapshot on reconnect.

- [ ] **Step 4: Run repository tests**

  Run: `npx vitest run apps/api/src/admin-change-repository.test.ts`

### Task 4.2: Publish minimal authenticated change events

- [ ] **Step 1: Write SSE RED tests**

  Cover admin authentication, member rejection, initial revision snapshot, changed-domain event, duplicate suppression, heartbeat and disconnect cleanup.

- [ ] **Step 2: Implement one shared poller per API process**

  Start a bounded 1-second revision poll only while at least one Admin subscriber exists. Query the small revision table once per process tick, not once per connection.

- [ ] **Step 3: Emit minimal events**

  Send only domain, revision and updatedAt. Never send Provider configuration, account data, permission rules, secrets or audit content.

- [ ] **Step 4: Touch revisions after successful writes**

  Call the Batch 3 `adminChangeDomainsForMutation()` classifier after the API has committed a successful write, then touch only those revisions. Failed, rejected or rolled-back writes do not advance revisions.

- [ ] **Step 5: Run SSE tests**

  Run: `npx vitest run apps/api/src/admin-change-stream.test.ts`

### Task 4.3: Consume events with guarded refresh

- [ ] **Step 1: Write hook RED tests**

  Assert one EventSource, exponential reconnect, visibility snapshot check, affected-key invalidation, clean-page force refresh and dirty-page notification.

- [ ] **Step 2: Implement freshness state**

  Track dirty domains and pending remote domains separately. Provide `markDirty`, `markClean`, `receiveRemoteChange` and `consumePendingChange` operations.

- [ ] **Step 3: Integrate existing dirty callbacks**

  Connect Provider/model/RH/assistant/agent/settings editors that already expose dirty state. Read-only pages register as clean.

- [ ] **Step 4: Enforce security-event priority**

  Session, account-disable and permission changes trigger immediate current-session/permission validation even if another form is dirty.

- [ ] **Step 5: Add the guarded update UI**

  Reuse existing Admin status/banner patterns. Message: `后台数据已更新` with explicit `重新加载` action; do not add a modal or overwrite form fields.

- [ ] **Step 6: Run Admin hook and presentation tests**

  Run:

  ```text
  npx vitest run apps/admin/src/use-admin-change-stream.test.ts
  npx vitest run apps/admin/src/admin-query-client.test.ts
  npm run type-check -w @xinghuan/admin
  ```

### Task 4.4: Documentation, harness and local acceptance

- [ ] **Step 1: Update system documentation**

  Record stateless LLM semantics, portable relative references, provider-media token security, query invalidation and SSE freshness in the listed system docs.

- [ ] **Step 2: Add focused verification scripts**

  Add root scripts for stateless LLM payload, Provider media portability and Admin write-after-read freshness; include them in `verify:important` only after stable focused runtime.

- [ ] **Step 3: Run the mandatory local matrix**

  Run:

  ```text
  npm run verify:quick
  npm test
  npm run build:single-port
  npm run verify:authority-state
  npm run harness:verify:project
  npm run harness:verify:workspace
  npm run harness:verify:release
  ```

- [ ] **Step 4: Execute two-session browser acceptance**

  At `1920x1080`, use two authenticated Admin sessions. Change Provider, model, account, permission, RH item, public resource and system setting in session A; verify session B updates within 3 seconds or shows the guarded notice when dirty.

- [ ] **Step 5: Execute LLM media acceptance**

  Test direct upload, generated output, Generation Library, public Resource Library and a public workflow JSON reference with MIMO 2.5. Inspect the outbound payload and confirm there are no naked relative URLs or historical turns.

- [ ] **Step 6: Run portability acceptance**

  Run the resolver fixture against two synthetic public origins and verify no tracked file, Canvas JSON or database fixture contains either origin after execution.

- [ ] **Step 7: Commit Batch 4**

  Commit: `feat(admin): synchronize domain revisions across sessions`

### Task 4.5: Gray release checkpoint after authorization

- [ ] Build one encrypted server artifact from the completed four-batch source state.
- [ ] Deploy to the explicitly authorized Gray target only; do not rebuild between API and Worker.
- [ ] Verify API/Worker active, permission readiness, public status, Provider media signed download and Admin SSE reconnect.
- [ ] Repeat MIMO image analysis with no more than the authorized paid call count.
- [ ] Repeat two-session Admin acceptance and inspect request counts for refetch storms.
- [ ] Record release/validation logbooks and update canonical state only after runtime success.
- [ ] Stop before Production until the user reviews Gray visual behavior and explicitly authorizes promotion.

### Batch 4 acceptance

- Other Admin sessions observe clean-page changes within 3 seconds.
- Dirty forms receive a non-destructive update notice.
- Security changes revalidate immediately.
- One browser uses one Admin EventSource and does not create a request storm.
- Full local matrix passes before any Gray action.
- Gray deployment remains an explicit authorization gate.

---

## 跨批次验收矩阵

| Domain | Functional acceptance | Portability/security acceptance | Freshness acceptance |
| --- | --- | --- | --- |
| LLM request | Current turn only | No historical media leakage | N/A |
| LLM display | Default latest turn; optional full history | Display switch cannot change payload | Immediate local rendering |
| User file | MIMO can read | Owner-scoped signed URL | N/A |
| Shared resource | MIMO can read shared content | Permission checked; relative ID persisted | Resource edits invalidate only resource/permission domains |
| Generation library | Active owner artifact can be read | Expiry and owner enforced | Generation changes do not clear unrelated Admin cache |
| Provider/model | Save and test remain correct | Secrets absent from events/cache | Own write immediate; remote write <= 3s |
| Accounts/groups | Revision behavior preserved | Root/admin boundaries preserved | Own write immediate; remote write <= 3s |
| Permissions | Rules and subjects remain authoritative | No stale allow after deny/revoke | Security refresh immediate |
| RH | Groups/items/keys correct | Existing two-gate permission preserved | Targeted refresh only |
| System | Configured/effective values correct | Environment isolation preserved | Live update without overlapping fetch |

## 停止条件

- Any persisted record contains a runtime hostname, IP, absolute disk path or expiring signed URL.
- Unknown relative media is passed through to an upstream Provider.
- Provider media token can access a different owner, environment or unauthorized shared asset.
- `showHistory` changes the outbound message count.
- Admin mutation succeeds but a cached old value is rendered afterward.
- Cache invalidation clears unrelated domains or causes a refetch storm.
- SSE exposes business payloads or creates more than one connection per Admin tab.
- Dirty forms are overwritten without explicit user action.
- Gray/Production deployment begins without current explicit authorization.

## 自审结果

- Spec coverage: all accepted LLM, media portability, same-session Admin and cross-session Admin requirements map to one of four batches.
- Placeholder scan: no `TBD`, `TODO` or unspecified implementation task remains.
- Type consistency: `showHistory`, `ProviderMediaClaim`, `AdminChangeDomain` and query-prefix names are stable across tasks.
- Scope: no framework migration, no lifecycle redesign and no Production deployment are included.
