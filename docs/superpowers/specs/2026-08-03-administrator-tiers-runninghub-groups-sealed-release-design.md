# 管理员分级、RunningHub 分组权限与生产制品封装设计

## 状态

- 日期：2026-08-03
- 状态：待用户复核
- 当前代码与部署基线：`0.8.15`
- 范围：Auth / Admin / API / RunningHub / Permission Platform / Environment Sync / Release / Ops

## 目标

本轮改造交付三个彼此独立、可以分别测试和回滚的能力：

1. 在现有 `admin/member` 角色之上增加最高管理员与次级管理员层级，次级管理员能够治理业务内容，但不能看到、推断或管理最高管理员账号。
2. 为 RunningHub 应用和工作流增加 Provider 级分组，并把分组权限作为单项权限之外的外层边界。
3. 将开发源码制品与生产部署制品分离，生产部署包不再携带项目源码、设计文档、测试或 source map。

## 不做的事情

- 不把现有统一权限平台重写成新的通用 ABAC 引擎。
- 不把 RunningHub JSONB 目录整体迁移成多张关系表。
- 不承诺浏览器端 JavaScript 绝对不可分析。
- 不使用加密壳或运行时自解密方案；该方案会增加故障面，但不能阻止拥有服务器 root 权限的人分析运行代码。
- 不在本轮引入移动端或平板端专用交互；视觉验收固定为 PC `1920x1080`。

## 共同不变量

- `role` 继续只允许 `admin | member`，避免破坏现有管理员旁路和成员权限判断。
- 管理员层级使用独立字段 `administratorTier: root | operator`；成员没有管理员层级。
- 旧数据中 `role=admin` 且缺少层级的账号必须兼容归一为 `root`，迁移后数据库显式回填。
- 最高管理员身份过滤必须发生在服务端；前端隐藏只用于体验。
- Gray 与 Production 的最高管理员账号属于环境本地身份，不通过环境同步复制。
- RunningHub 未分组条目保持当前权限行为，不因升级被默认关闭。
- RunningHub 分组权限与单项权限按逻辑与计算：`groupAllowed && itemAllowed`。
- Production 晋级复用已在 Gray 验收的同一版本、同一 archive SHA256，不重新构建。
- 所有密钥、密码、环境文件和服务器凭据继续位于现有外部配置或 shared 数据目录，不进入制品。

## 设计一：管理员分级与最高管理员隐身

### 领域模型

```ts
export const ADMINISTRATOR_TIERS = ["root", "operator"] as const;
export type AdministratorTier = (typeof ADMINISTRATOR_TIERS)[number];

export interface AdministratorIdentity {
  role: "admin";
  administratorTier: AdministratorTier;
}
```

持久化字段为 `xh_users.administrator_tier`：

- `role=member` 时必须为 `NULL`。
- `role=admin` 时必须为 `root` 或 `operator`。
- SQL 迁移先增加可空列，再将全部存量 admin 回填为 root，最后增加一致性约束。

### 权限矩阵

| 动作 | root | operator |
| --- | --- | --- |
| 查看和修改 Provider、模型、RH、资源、任务、权限策略等业务内容 | 允许 | 允许 |
| 查看普通成员 | 允许 | 允许 |
| 创建、编辑、禁用、删除普通成员 | 允许 | 允许 |
| 查看其他 operator | 允许 | 允许 |
| 创建、编辑、禁用、删除 operator | 允许 | 禁止 |
| 查看 root 身份、会话和原始审计身份 | 允许 | 不可见 |
| 创建、编辑、禁用、删除 root | 允许，但不能破坏最后一个 root | 禁止 |
| 把 member 升级为 admin，或修改管理员层级 | 允许 | 禁止 |

### 不可推断边界

operator 访问账号治理数据时：

- `/api/admin/users` 不返回 root 记录，数量和汇总也以过滤后的集合计算。
- 对 root ID 的 PATCH/DELETE 返回与不存在账号相同的 `404 USER_NOT_FOUND`，不能返回 `403 ROOT_REQUIRED`。
- `/api/admin/sessions` 不返回 root 会话，撤销 root 会话同样返回 `404 SESSION_NOT_FOUND`。
- 审计记录如果目标是 root 账号则整条隐藏；如果是 root 对业务对象的操作，则保留业务事件但将 actor 投影为固定的“系统操作”，删除 actor ID、邮箱、IP 和 User-Agent。
- 后台助手只能读取已经完成同一可见性投影的页面上下文和 API 数据。
- 环境同步 snapshot 不包含 root，目标端也拒绝用同步记录覆盖同邮箱的本地 root。

### 最后一个 root

以下动作必须在数据库事务内锁定所有启用 root 后判断：

- 删除 root；
- 禁用 root；
- 把 root 降级为 operator/member。

只要动作会让启用 root 数量变成 0，就以 `409 LAST_ROOT_REQUIRED` 拒绝。应用层预检只用于更友好的错误信息，数据库事务是最终安全边界。

## 设计二：RunningHub Provider 级分组

### 数据模型

Provider 新增 `rh_groups jsonb not null default '[]'::jsonb`。组结构：

```ts
export interface RhCatalogGroup {
  id: string;
  providerId: string;
  name: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}
```

现有 `RunningHubCatalogEntry` 和公开 `RhCatalogItem` 增加：

```ts
groupId?: string;
groupName?: string;
```

`groupId` 缺失或空字符串表示未分组。条目 ID、catalogId 和运行目标 ID 不因移动分组而变化。

### 生命周期

- 新建应用或工作流时默认未分组。
- 创建表单可以选择已有组，也可以先创建组再把新条目放入该组。
- 编辑条目时可以移动到其他组或未分组。
- 删除组不会删除条目；组内条目在同一次 Provider 更新中回到未分组。
- 禁用组会让组内条目从 public catalog 消失，并阻止历史画布继续执行这些条目。
- 分组名称在同一 Provider 内不区分大小写唯一。

### 权限主体与双闸门

新增权限主体：

```text
runninghub.group/*
runninghub.group/{providerId}/{groupId}
```

单项主体保持：

```text
runninghub.app/{catalogId}
runninghub.workflow/{catalogId}
```

不能只把 group subject 放进 item 的 `parentKeys`，因为现有 resolver 会选择最具体规则，可能让 item allow 覆盖 group deny。运行时必须显式执行两次决策：

```ts
const groupAllowed = item.groupId
  ? await decide(groupSubjectKey(item.providerId, item.groupId), action)
  : true;
const itemAllowed = await decide(itemSubjectKey(item), action);
return groupAllowed && itemAllowed;
```

同一规则应用于 catalog 列表、catalog 详情、直接 submit 和 Workflow Run 恢复执行。

### 后台与前台

- Admin RH 左侧目录按组显示可折叠分区，未分组固定为最后一组。
- 条目编辑器基础信息区增加分组选择器和“新建分组”入口。
- 组管理支持创建、改名、排序、启停和删除。
- 前台 RH 节点下拉框使用分组标题展示；无权组不会返回到浏览器。
- public catalog 同时返回 item 的 `groupId/groupName` 和 provider 的可见 groups，避免前端自行猜测。

### 环境同步

Provider snapshot 增加 `rhGroups`。应用顺序固定为：先规范化组，再规范化条目并清除不存在的 groupId。同步预览显示组数量，但不把组内敏感权限规则混入 Provider snapshot；权限规则继续由权限平台自己的环境治理负责。

## 设计三：开发制品与生产制品分离

### 当前问题

当前 `scripts/package-release.mjs` 把 `apps/api/src`、`apps/worker/src`、`CONTEXT.md`、`docs/adr`、`AGENTS.md`、`MEMORY.md` 和 `DEVLOG.md` 放入 release archive，并且 `verify-release-package-contract.mjs` 明确要求这些源码存在。当前 archive 不能被称为封装后的生产制品。

### 双制品

内部开发制品仍由 Git 仓库和正常构建产物组成，不改变现有开发流程。

生产部署制品只包含：

- 经 esbuild 打包、压缩且无 source map 的 API 与 Worker 运行文件；
- Vite 构建后的 Web/Admin 静态文件，并显式关闭 source map；
- 数据库 SQL migration；
- `scripts/start-single-port.mjs`、`scripts/db-migrate.mjs` 和编译后的 permission readiness CLI；
- 运行所需 package manifests、lockfile、非密配置模板、systemd/nginx 模板；
- `BUILD-MANIFEST.json` 与简短的 `RELEASE_PACKAGE.md`。

生产制品禁止包含：

- `src/`、`.ts`、`.tsx`、`.map`、测试、fixture；
- `docs/`、`CONTEXT.md`、ADR、AGENTS、MEMORY、DEVLOG；
- `.git`、本地日志、output、uploads、data、`.env`；
- 本地 SSH key、cookie、token 或数据库 URL。

### 服务端 bundle

新增独立的 production runtime build，不替换开发用的 TypeScript 构建：

```text
API entry: apps/api/src/server.ts
Worker entry: apps/worker/src/worker.ts
Format: ESM
Platform: node
Bundle: true
Minify: true
Sourcemap: false
External runtime packages: pg, redis, sharp, busboy
Internal @xinghuan/* packages: bundled
```

输出在临时 staging 中映射回现有路径 `apps/api/dist/server.js` 和 `apps/worker/dist/worker.js`，因此 systemd 和现有 start scripts 不需要改变。

### 安装和运行

- 远端安装改为 `npm ci --omit=dev`。
- archive 保留 workspace package manifests 以兼容当前 lockfile，但不携带内部 workspace 的 dist/source。
- 制品合同必须启动一次 API/Worker 模块加载 smoke，证明 bundle 没有遗留对 `@xinghuan/*` 源码或 dist 的运行时 import。
- permission readiness 改为编译在 API runtime 中的 CLI，通过 `node apps/api/dist/cli/permission-readiness.js` 执行，不再依赖远端 `tsx` 和源码。

### 构建清单

`BUILD-MANIFEST.json` 至少包含：

```json
{
  "schemaVersion": 1,
  "version": "0.8.16",
  "sourceCommit": "40-character Git commit SHA",
  "builtAt": "ISO-8601 UTC timestamp",
  "artifactType": "production-runtime",
  "sourceMaps": false,
  "entries": [],
  "contentManifestSha256": "64-character lowercase SHA-256"
}
```

archive 自身的 SHA256 不能可靠写回 archive 内部，否则写入动作会再次改变 archive。打包流程因此同时输出外部 sidecar，例如 `20260803-sealed-production-artifact-v0816-r1.tar.gz.sha256`；内部 manifest 只记录条目清单的稳定摘要。manifest 和 sidecar 都不包含绝对本地路径、用户名、服务器地址或 secrets。

## 推荐发布顺序

三个子系统独立发版，避免一次大包同时修改身份、目录权限和部署方式：

1. `0.8.16`：只切换 sealed production artifact。Gray 验证启动、migration、permission readiness、API/Worker 和回滚，再以同 archive 晋级 Production。
2. `0.8.17`：管理员分级与 root 隐身。先备份 auth 相关表，Gray 创建 operator 做攻击面验证，通过后晋级 Production。
3. `0.8.18`：RH 分组、分组权限和前后台展示。Gray 验证组 CRUD、双闸门和历史画布阻断，通过后晋级 Production。

如果用户要求合并为一次 Gray 发布，可以合并代码，但仍保留三个独立提交和三个独立验收门；默认不推荐合并。

## 验收总表

### Sealed artifact

- archive 扫描不包含受禁路径和扩展名。
- API、Worker、Web、Admin、migration 和 permission readiness 正常。
- Gray rollback 到 `0.8.15` 成功路径已验证。
- Production 使用 Gray 同一 SHA256 archive。

### Administrator tiers

- 存量 admin 全部迁移为 root。
- operator 能治理业务数据和普通成员。
- operator 看不到 root 的用户记录、汇总、会话、原始审计身份和同步记录。
- 直接访问已知 root ID 返回 404。
- 最后一个启用 root 无法被删除、禁用或降级。

### RunningHub groups

- 新建条目默认未分组，创建和编辑均可选择组。
- 删除组后条目回到未分组。
- group deny + item allow 仍拒绝；group allow + item deny 仍拒绝；两者允许才通过。
- public catalog、详情、submit 和 Workflow Run 都使用同一双闸门。
- 前台 RH 节点按组显示，Admin 目录按组管理。

## 回滚

- 所有 migration 只前向增加字段，不删除旧字段；旧版本读取新增列不会受影响。
- 管理员层级回滚到旧代码后，`role=admin` 仍保持旧管理员能力，但在再次升级前必须限制账号治理操作。
- RH 分组回滚到旧代码后，条目仍保存在原 `rh_apps/rh_workflows`，`groupId` 被旧 normalizer 忽略；组元数据保留但不参与运行。
- sealed artifact 回滚直接切换到 `0.8.15` release 目录，不修改 shared data 和环境文件。
