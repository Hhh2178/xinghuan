# Phase 3 RunningHub 工作流字段映射与画布消费灰度发布记录

日期：2026-06-07
发布号：`20260607-0218-phase3-runninghub-workflow-gray`

## 范围

- 后台 RunningHub 工作流新增 `runTargetId`、工作流 JSON、字段映射持久化。
- 新增公开目录接口 `GET /api/runninghub/catalog`。
- 画布 `RunningHubNode` 新增后台工作流预设消费。

## 发布结果

- `current` 已切到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260607-0218-phase3-runninghub-workflow-gray`
- 服务状态：
  - `xinghuan-canvas-next.service`: `active`
  - `xinghuan-canvas-next-worker.service`: `active`

## 验收

- `npm run verify:runninghub-workflow-contract`
  - 返回全部 `PASS`
- `npm run verify:runninghub-workflow-api`
  - 返回 `ok=true`
  - `workflowCount=0`
  - `appCount=0`
  - `firstWorkflow=null`

## 说明

- 当前灰度环境尚未录入已启用的 RunningHub 工作流卡片，因此公开目录接口虽然已经通了，但返回为空列表。
- 本次未修改内部代理相关服务或路由。
