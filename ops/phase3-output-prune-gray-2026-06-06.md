# Phase 3 输出素材落库与自动清理灰度发布记录

日期：2026-06-06
发布号：`20260606-1515-phase3-output-prune-gray`

## 范围

- Worker 图像任务成功后输出素材落库。
- 14 天保守型输出素材自动清理。
- 输出素材清理 systemd timer 接入。

## 发布结果

- `current` 已切到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260606-1515-phase3-output-prune-gray`
- 服务状态：
  - `xinghuan-canvas-next.service`: `active`
  - `xinghuan-canvas-next-worker.service`: `active`
  - `xinghuan-canvas-next-output-prune.timer`: `active (waiting)`
- 定时器下一次触发：
  - `2026-06-07 04:16 CST`

## 验收

- `curl -fsS http://127.0.0.1:18200/api/status`
  - 返回 `environment=gray`
- `npm run verify:worker-output-materials`
  - 返回 `ok=true`
  - 任务：`task-1780725769684-pvlouq`
  - 资源项：`res-1780725770036-i16lge`
  - 文件：`/files/output/task_output_task-1780725769684-pvlouq_1.png`
- `npm run cleanup:output-materials:dry-run`
  - 返回 `ok=true`
  - `retentionDays=14`
  - `deletedItemIds=[]`

## 环境变更

- `canvas-next.env` 已补入：
  - `XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS=14`

## 说明

- 本次未在灰度手动执行真实 `cleanup:output-materials --apply`，避免在首次上线时把自动清理和人工触发混在一起。
- 首轮真实执行将由定时器在 `2026-06-07 04:16 CST` 后自动发生，届时需要补一条运行审计记录。
