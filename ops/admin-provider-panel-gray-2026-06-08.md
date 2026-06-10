# 后台 Provider 面板灰度部署记录 - 2026-06-08

## 目标

- 将管理后台 Provider 面板拆分与主入口薄壳化改动发布到灰度环境。
- 保持灰度入口 `canvas-next.hhh2121.xyz`、单端口 `127.0.0.1:18200` 和 Worker 服务继续正常运行。
- 用服务器本地验收和公网 smoke 确认后台入口、权限、单端口服务没有被本轮后台重构破坏。

## Release

- Release ID: `20260608-1200-admin-provider-panel-gray`
- 灰度域名: `https://canvas-next.hhh2121.xyz`
- 服务端口: `127.0.0.1:18200`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`
- 当前 release 路径: `/opt/apps/xinghuan-canvas-next/releases/20260608-1200-admin-provider-panel-gray`

## 变更范围

- `apps/admin/src/main.tsx`
  - 重写为薄壳入口，只保留认证、导航、统一数据加载和页面切换。
  - 保留 `Capability`、`ConfirmAction`、`AdminUser`、`ProviderRecord`、`ModelRecord`、`Summary`、`TaskRecord` 兼容导出，继续满足既有契约脚本。
- `apps/admin/src/admin-api-settings-panel.tsx`
  - 承接 Provider 设置页主体、模型拉取、模型导入、手动模型创建和删除确认。
- `apps/admin/src/admin-model-picker.tsx`
  - 修复已存在模型能力分类优先级问题，避免旧模型被误判为图像模型。
- 新增：
  - `apps/admin/src/admin-types.ts`
  - `apps/admin/src/admin-model-editor.tsx`
  - `apps/admin/src/admin-runninghub-panel.tsx`
  - `apps/admin/src/admin-lora-panel.tsx`
- `scripts/verify-admin-interaction-guards.mjs`
  - 调整为识别新的 Provider 面板拆分边界，不再错误假设所有后台交互都留在 `main.tsx`。

## 服务器部署动作

- 本机打包 release：`releases/20260608-1200-admin-provider-panel-gray.tar.gz`
- 打包时显式排除：
  - `.git`
  - `node_modules`
  - `logs`
  - `output`
  - `.tmp`
  - `.playwright-cli`
  - `.codegraph`
  - `releases`
  - `apps/api/data`
  - 各 workspace `dist`
- 上传到服务器：`/tmp/20260608-1200-admin-provider-panel-gray.tar.gz`
- 解压到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260608-1200-admin-provider-panel-gray`
- 在 release 目录执行：
  - `npm ci`
  - `npm run build:single-port`
- 切换 `/opt/apps/xinghuan-canvas-next/current` 指向新 release。
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 验收结果

服务器本地通过：

- `npm run verify:single-port`
- `npm run verify:admin-interaction-guards`
- `npm run verify:admin-confirm-action-dialog-contract`
- `npm run verify:admin-manual-model-dialog-contract`

公网 smoke 通过：

- `https://canvas-next.hhh2121.xyz/` 返回 `200`
- `https://canvas-next.hhh2121.xyz/admin` 返回 `200`
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `200`
- `curl -fsS https://canvas-next.hhh2121.xyz/api/status` 返回 `environment=gray`

服务状态通过：

- `readlink /opt/apps/xinghuan-canvas-next/current` 返回新 release
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`
- `systemctl is-active xinghuan-canvas-next-worker.service` 返回 `active`

## 当前残留问题

- `npm run verify:grsai-draw-gray` 的同步图像代理部分通过，但异步 Worker 部分未在脚本等待窗口内得到 `succeeded` 结果，因此整条 GRSAI 异步灰度脚本仍为失败。
- Worker 日志显示新建 GRSAI 验收任务已被 `canvas-next-worker-1` 领取，说明不是登录或队列完全失效，更像是 GRSAI 异步回归脚本和当前任务完成时序之间仍需继续排查。

## 当前结论

本轮后台拆分改动已经成功上线灰度，`canvas-next.hhh2121.xyz` 的主站、后台入口、权限链路和单端口核心验收正常。当前阻塞项只剩 GRSAI 异步灰度回归脚本未闭环，需要下一轮继续排查。
