# RunningHub Sticky Gray Release - 2026-06-19

## 发布目标

- 修复 RH 工作台滚动时顶部筛选条与后台顶栏重叠的问题。
- 修复 RH 编辑器顶部摘要卡与正文区滚动重叠的问题。
- 将 RH 编辑器区块提示与 AI 分析区整理为更清晰的工作台结构。

## 灰度发布

- 环境：`gray`
- 版本：`v0.3.4`
- release：
  - `20260619-runninghub-sticky-gray-r6-v034-d9b653c`
- 当前指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260619-runninghub-sticky-gray-r6-v034-d9b653c`

## 本轮变更

- RH 工作台：
  - 搜索 / 分类 / 状态筛选改为单独吸顶控制层。
  - 避免滚动时筛选条钻入后台总顶栏下方造成视觉重叠。
- RH 编辑器：
  - 顶部摘要卡改为独立吸顶头部。
  - 右侧摘要 / 测试侧栏取消额外 sticky，避免与正文区叠层冲突。
  - 新增编辑区块提示 chips，降低长表单的阅读负担。
- AI 分析并填写：
  - 输入区改为 workbench 结构。
  - 增加“输入来源 / 输出结果 / 应用方式”提示卡。

## 验证

- 本机：
  - `node scripts/verify-runninghub-workflow-api.mjs`
  - `npm run build -w @xinghuan/admin`
  - `npm run build:single-port`
  - `codegraph sync`
- 灰度：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 验证结果

- `/api/status`：
  - `version = 0.3.4`
  - `environment = gray`
- gray gate 全部通过。

## 备注

- 本轮为后台 UI / 交互收口，不包含新 migration。
- RH 运行时与队列治理状态保持不变，继续沿用 `v0.3.4` 主版本。
