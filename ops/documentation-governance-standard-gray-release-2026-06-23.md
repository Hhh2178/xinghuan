# 文档治理正式规范 gray 发布记录（2026-06-23）

## 发布目标

- 将文档治理正式规范、兼容入口收口和发布包治理文档补齐一并落到 gray。
- 保持现有业务运行链路不变，只推进版本、入口和 release 包可追溯性。

## 发布标识

- 目标版本：`v0.4.8`
- gray release：`20260623-documentation-governance-standard-gray-r1-v048`
- 发布范围：
  - `docs/governance/documentation-governance-standard.md`
  - `docs/governance/*`
  - `docs/documentation-governance.md`
  - `AGENTS.md`
  - `scripts/package-release.mjs`
  - 当前状态入口同步文件

## 预期结果

- gray `/api/status` 返回 `version = 0.4.8`
- gray release 包包含：
  - `AGENTS.md`
  - `MEMORY.md`
  - `DEVLOG.md`
  - `docs/INDEX.md`
  - `docs/governance/`
- 当前 gray release 指针切到本次 release

## 验收要点

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
- `systemctl is-active xinghuan-canvas-next.service`
- `systemctl is-active xinghuan-canvas-next-worker.service`
- `curl -fsS http://127.0.0.1:18200/api/status`
- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:request-chain-observability`
- `XINGHUAN_VERIFY_BASE_URL=https://canvas-next.hhh2121.xyz npm run verify:system-observability`

## 备注

- 本轮不引入新 migration。
- 本轮重点是“治理规范随包落盘”，不是功能行为调整。
