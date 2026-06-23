# ApiSettings Decomposition Gray Release - 2026-06-24

## 发布目标

- 把 `apps/web/src/components/ApiSettings.tsx` 从“只列入 watchlist”推进到真实结构拆分。
- 将设置备份导入导出 helper 和通用 / 分类 API Key 字段卡片从主文件下沉。
- 在保持版本号 `v0.4.16` 不变的前提下完成一轮新的 gray 放行，给后续继续拆 `provider sections / settings forms / save helpers` 留出空间。

## 发布信息

- 环境：`gray`
- 版本：`v0.4.16`
- release：`20260624-api-settings-decomposition-gray-r1-v0416`
- 上一灰度 release：`20260624-hotspot-decomposition-gray-r1-v0416`

## Agent 已验证

### 本地代码与 contract

- `npm run verify:api-settings-backup-helper-contract`
- `npm run verify:api-settings-key-field-split-contract`
- `node scripts/verify-api-settings-helper-split-contract.mjs`
- `npm run build -w @xinghuan/web`
- `node scripts/pre-commit-governance.mjs`
- `npm run codegraph:sync`

### 工程治理链

- `npm run verify:hotspot-watchlist-contract`
- `node scripts/verify-engineering-governance-contract.mjs`
- `npm run verify:release-worktree-clean`

### 结构收口结果

- `apps/web/src/components/ApiSettings.tsx`
  - 行数：`2190 -> 2162`
  - 下沉到：
    - `apps/web/src/components/apiSettingsHelpers.ts`
    - `apps/web/src/components/ApiSettingsKeyField.tsx`

## 本次实际放行证据

- prepare：
  - `npm run release:gray:prepare:runninghub -- --release=20260624-api-settings-decomposition-gray-r1-v0416`
  - 归档包：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-api-settings-decomposition-gray-r1-v0416.tar.gz`
  - 包大小：`5.36 MB`
  - 临时 staging：`C:\Users\Administrator\AppData\Local\Temp\xinghuan-release-b9pFqc`
- deploy：
  - `npm run release:gray:deploy -- --release=20260624-api-settings-decomposition-gray-r1-v0416 --archive="D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b\dist-release\20260624-api-settings-decomposition-gray-r1-v0416.tar.gz" --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem"`
- verify：
  - `npm run release:gray:verify -- --ssh-key="D:\codex\服务器\Tencent_Cloud_Server.pem" --expected-version=0.4.16 --expected-environment=gray`
- 远端 current release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-api-settings-decomposition-gray-r1-v0416`
- 远端服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 远端状态接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
  - 两者均返回：
    - `version = 0.4.16`
    - `environment = gray`
    - `dataDir = /opt/apps/xinghuan-canvas-next/shared/data`

## 本轮额外说明

- 第一次远端 verify 因为和 deploy 并行执行，短暂读到了旧的 `currentRelease`。
- 已补做串行 verify，最终确认 gray `current` 已切到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-api-settings-decomposition-gray-r1-v0416`

## 待用户验收

### 视觉验收

- 设置页视觉层、卡片布局和交互观感由用户实机检查，不由 Agent 代替。

### 真实业务链路

- 设置页导入导出、Key 明文预览、分类 Key 折叠区与高级设置区的真实使用体验由用户复核。

## 风险与残留问题

- 这只是 `ApiSettings.tsx` 的第一批真实拆分，主文件仍然很大。
- 下一步优先仍是：
  - `provider sections`
  - `settings forms`
  - `save helpers`

## 回滚信息

- `current` 回滚目标：
  - `/opt/apps/xinghuan-canvas-next/releases/20260624-hotspot-decomposition-gray-r1-v0416`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `/api/status`
  - `/api/settings`
  - `/api/settings/raw`
