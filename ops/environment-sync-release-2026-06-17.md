# gray / production 环境同步能力发布与联调记录 - 2026-06-17

## 目标

- 将后台“环境同步”能力发布到 gray 与 production。
- 为 gray / production 两端补齐环境变量，打通内部受控同步接口。
- 完成真实双向联调，确认不是只有本地契约通过。

## Release 信息

- 对外版本号：
  - `v0.3.1`
- 本轮版本治理约束：
  - 同一批 gray / production release 可以拥有不同目录名，但必须共享同一个对外应用版本号。
  - 后续每次真实发布都必须推进 non-major 版本；major 版本仅在用户明确要求时升级。

- gray release：
  - 初始发布：`20260617-environment-sync-gray-r1-f881c28-dirty`
  - clean rebuild 补发：`20260617-environment-sync-gray-r2-795c1e5`
  - 布局与版本收口发布：`20260617-environment-sync-layout-v031-gray-r1-dfd5f37`
- production release：
  - 初始发布：`20260617-environment-sync-prod-r1-f881c28-dirty`
  - clean rebuild 补发：`20260617-environment-sync-prod-r2-795c1e5`
  - 布局与版本收口发布：`20260617-environment-sync-layout-v031-prod-r1-dfd5f37`
- gray current：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-environment-sync-gray-r2-795c1e5`
- production current：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-environment-sync-prod-r2-795c1e5`
- gray current（本轮最终）：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260617-environment-sync-layout-v031-gray-r1-dfd5f37`
- production current（本轮最终）：
  - `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260617-environment-sync-layout-v031-prod-r1-dfd5f37`
- 本地工作树基线：
  - 初始发布：`f881c28`
  - clean rebuild 补发：`795c1e5`

## 2026-06-17 clean rebuild 补发说明

- 这次 gray 补发不是功能范围扩张，而是发布一致性修复。
- 原 `r1-f881c28-dirty` 暴露出一个发布流程问题：
  - 提交后的 `server.ts` 已引用 `safeLongText` / `safePromptText`
  - 但对应 helper 与依赖接口声明仍停留在本地未提交状态
  - 结果是脏工作树可以继续打包，但干净 release worktree 无法完成 `npm run build:single-port`
- 本次通过提交 `795c1e5` 收口：
  - `apps/api/src/api-sanitizers.ts`
  - `apps/api/src/external-proxy.ts`
  - `apps/api/src/provider-generation-task-service.ts`
  - 以及对应契约脚本
- 补发后 gray 已切到 clean commit 对齐的 release：
  - `20260617-environment-sync-gray-r2-795c1e5`
- 随后 production 也已切到同一 clean commit 对齐的 release：
  - `20260617-environment-sync-prod-r2-795c1e5`

## 配置变更

两端服务器环境文件都已补齐：

- `XINGHUAN_ENVIRONMENT_SYNC_TOKEN`
- `XINGHUAN_GRAY_API_BASE_URL=http://127.0.0.1:18200`
- `XINGHUAN_PRODUCTION_API_BASE_URL=http://127.0.0.1:18100`

对应文件：

- gray：
  - `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- production：
  - `/opt/apps/xinghuan-canvas/shared/canvas.env`

## 本地发布前验证

- `node scripts/verify-admin-environment-sync-contract.mjs`
- `node scripts/verify-environment-sync-service.mjs`
- `npm run build -w @xinghuan/shared`
- `npm run build -w @xinghuan/api`
- `npm run build -w @xinghuan/admin`
- `npm run build:single-port`
- `npm run verify:release-package-contract`
- `npm run package:release -- 20260617-environment-sync-gray-r1-f881c28-dirty`

结果：

- 全部通过。
- release 包生成成功：
  - `dist-release/20260617-environment-sync-gray-r1-f881c28-dirty.tar.gz`
  - `sizeMB = 5.39`

## 实际发布步骤

### gray

1. 上传 release 包到：
   - `/tmp/20260617-environment-sync-gray-r1-f881c28-dirty.tar.gz`
2. 解包到：
   - `/opt/apps/xinghuan-canvas-next/releases/20260617-environment-sync-gray-r1-f881c28-dirty`
3. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
   - `npm run db:migrate`
4. 切换 `current` 并重启：
   - `xinghuan-canvas-next.service`
   - `xinghuan-canvas-next-worker.service`

### production

1. 上传同一批 release 包到：
   - `/tmp/20260617-environment-sync-prod-r1-f881c28-dirty.tar.gz`
2. 解包到：
   - `/opt/apps/xinghuan-canvas/releases/20260617-environment-sync-prod-r1-f881c28-dirty`
3. 在新 release 目录执行：
   - `npm ci`
   - 加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`
   - `npm run db:migrate`
4. 切换 `current` 并重启：
   - `xinghuan-canvas.service`
   - `xinghuan-canvas-worker.service`

## 验收

### gray gate

- `npm run verify:release-preflight = ok`
- `npm run verify:request-chain-observability = ok`
- `npm run verify:system-observability = ok`
- `https://canvas-next.hhh2121.xyz/api/status = 200`

### production gate

- `npm run verify:release-preflight = ok`
- `npm run verify:request-chain-observability = ok`
- `npm run verify:system-observability = ok`
- `https://canvas.hhh2121.xyz/api/status = 200`

### 双向联调

联调方式：

- 使用真实管理员登录态调用：
  - `/api/admin/environment-sync/preview`
  - `/api/admin/environment-sync/apply`
- 选择“已一致的真实 provider”做一次 `use_source` 写回 smoke：
  - 既能证明完整写链路可用
  - 又不会改坏线上配置内容

结果：

- `gray -> production`
  - 预览成功
  - provider 差异统计：
    - `identical = 7`
    - `missing_in_source = 1`
  - user 差异统计：
    - `identical = 7`
    - `missing_in_source = 1`
  - 真实写回对象：
    - `柏拉图`
  - apply 结果：
    - `status = applied`
  - 审计：
    - 已写入 `environment_sync.apply`
- `production -> gray`
  - 预览成功
  - provider 差异统计：
    - `identical = 7`
    - `missing_in_target = 1`
  - user 差异统计：
    - `identical = 7`
    - `missing_in_target = 1`
  - 真实写回对象：
    - `柏拉图`
  - apply 结果：
    - `status = applied`
  - 审计：
    - 已写入 `environment_sync.apply`

## 本次发现

- 这轮最容易误判的问题不是功能代码，而是远端执行方式：
  - `scp` 与远端解包脚本并行时，可能先执行到 `tar`，导致包尚未到 `/tmp`
  - 多行远端命令如果混入 CRLF，`systemctl` / `npm run` 会把结尾 `\\r` 当作命令名一部分
- 因此后续发布时：
  - 上传与解包不要并行
  - 远端长脚本应先去除 `CRLF`

## 结论

- gray / production 后台“环境同步”能力已完成发布。
- 两端环境变量已补齐。
- gray / production 双向差异预览与真实 provider 写回 smoke 已通过。
- 当前可将该能力视为已进入真实运行态，而不再只是本地实现。

## 后续标准验收入口

- 已新增标准脚本：
  - `npm run verify:environment-sync-smoke`
- 默认行为：
  - 在当前环境登录后台
  - 对对端环境执行差异预览
  - 选择一个 `identical` 的真实 provider 做安全 apply smoke
  - 校验后台审计中存在：
    - `environment_sync.preview`
    - `environment_sync.apply`
- 环境方向：
  - 若当前服务运行在 `18200`，默认按 `gray -> production`
  - 若当前服务运行在 `18100`，默认按 `production -> gray`
  - 也可显式指定：
    - `XINGHUAN_SYNC_SOURCE_ENV`
    - `XINGHUAN_SYNC_TARGET_ENV`
