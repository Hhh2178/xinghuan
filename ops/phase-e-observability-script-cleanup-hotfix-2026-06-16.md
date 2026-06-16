# Phase E 观测验收脚本测试 Provider 清理热补丁（2026-06-16）

## 目标

- 清掉 gray / production 后台中重新出现的 `Observability ...` / `System Observability ...` 假服务商。
- 将 `Phase E` 观测验收脚本修正为“验证后不留脏 Provider”。
- 把这次脚本热补丁正式纳入 current release 运维记录，避免后续只看 `2026-06-15` 发布文档时漏掉这次修复。

## 根因

`2026-06-15` 的 Phase E 验收脚本在 gray 和 production 都被执行过：

- `scripts/verify-system-observability.mjs`
  - 会创建 `system-obs-provider-*`
- `scripts/verify-request-chain-observability.mjs`
  - 会创建 `obs-provider-*`

这两条脚本原先都没有回收逻辑，因此每次线上验收都会在后台留下无模型、无 Key、`https://example.invalid` 的假 Provider。

## 修复内容

### 仓库脚本修正

- `scripts/verify-system-observability.mjs`
  - 不再创建测试 Provider
  - 改为通过带 `x-request-id` 的：
    - `POST /api/auth/admin-login`
    - `GET /api/admin/system`
    来补 requestId 覆盖样本
- `scripts/verify-request-chain-observability.mjs`
  - 保留 `provider.create` 审计链路验证
  - 新增 `finally` 清理，自动删除本轮创建的 `obs-provider-*`
- 新增回归约束：
  - `scripts/verify-observability-script-cleanup-contract.mjs`

### current release 热补丁

本次直接替换当前运行 release 中的脚本文件，不涉及服务重启：

- gray:
  - `/opt/apps/xinghuan-canvas-next/current/scripts/verify-system-observability.mjs`
  - `/opt/apps/xinghuan-canvas-next/current/scripts/verify-request-chain-observability.mjs`
- production:
  - `/opt/apps/xinghuan-canvas/current/scripts/verify-system-observability.mjs`
  - `/opt/apps/xinghuan-canvas/current/scripts/verify-request-chain-observability.mjs`

## 数据清理

初次清理结果：

- gray 删除 `14` 条：
  - `obs-provider-*`
  - `system-obs-provider-*`
- production 删除 `12` 条：
  - `obs-provider-*`
  - `system-obs-provider-*`

由于第一次复验时线上 still 用旧脚本，又新产生了：

- gray `2` 条
- production `2` 条

热补丁脚本替换后已再次清掉，当前两边剩余：

- gray `0`
- production `0`

## 验证

### 本地回归约束

- `node scripts/verify-observability-script-cleanup-contract.mjs`

结果：

- `ok = true`

### gray current

在 gray current release 目录内 source env 后执行：

- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

复核：

- `leakedProviders = 0`

### production current

在 production current release 目录内 source env 后执行：

- `node scripts/verify-system-observability.mjs`
- `npm run verify:request-chain-observability`

复核：

- `leakedProviders = 0`

## 影响

- 这次重新出现的假服务商，不是 `Agnes / Apimart / 魔搭 / mimo` 这类真实服务商回流。
- 根因完全落在 `Phase E` 观测验收脚本上，而不是服务启动、数据库同步或默认 bootstrap。
- 后续继续跑当前 Phase E 观测 gate，不应再在 gray / production 后台中留下新的 `Observability` / `System Observability` 假服务商。

## 后续要求

- 下次正式打新的 release 包时，必须把仓库里的这版脚本随包带上，不能只依赖 current release 热补丁。
- 若再增加新的“可写型”验收脚本，默认要求：
  - 要么不写业务对象
  - 要么必须自清理
