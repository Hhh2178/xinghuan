# 2026-07-03 ComfyUI Workflow Governance (Gray)

## 发布目标

- 将 ComfyUI 工作流治理链路正式推送到 gray
- 让后台工作流管理进入“自动解析输入/输出 + 可治理映射 + 画布节点消费统一 schema”的可验收状态
- 把灰度版本从 `v0.5.22` 推进到 `v0.5.23`，并修复发布前发现的 shared 版本常量漂移

## 发布信息

- 环境：`gray`
- 版本：`v0.5.23`
- release：`20260703-comfyui-workflow-governance-gray-r1-v0523`
- 上一灰度 release：`20260703-comfyui-dashboard-redesign-gray-r1-v0522`

## Agent 已验证

### 本地代码与产物

- 已补齐 `packages/shared/src/index.ts` 中的 `appVersion = "0.5.23"`，修复 release prepare 在 `verify-release-version-alignment` 阶段的阻塞
- 已通过：
  - `npm run type-check -w @xinghuan/shared`
  - `npm run build -w @xinghuan/shared`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run release:gray:prepare -- --release=20260703-comfyui-workflow-governance-gray-r1-v0523`
- gray 发布包已生成：
  - `dist-release/20260703-comfyui-workflow-governance-gray-r1-v0523.tar.gz`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260703-comfyui-workflow-governance-gray-r1-v0523 --archive=dist-release/20260703-comfyui-workflow-governance-gray-r1-v0523.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260703-comfyui-workflow-governance-gray-r1-v0523`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.23, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.23, environment gray`

## 待用户验收

### 视觉验收

- 后台 ComfyUI 工作流治理页的图标、标题、字段分组、输入输出映射区块是否达到预期视觉质量
- 工作流管理页在上传 JSON 后的布局、对齐、字段层级和操作顺序是否顺手

### 真实业务链路

- 上传本地 ComfyUI workflow JSON 后，后台是否能正确解析出输入项与输出项
- 管理员调整暴露参数、默认值、输出映射后，画布侧 `comfyui-app` 节点是否按治理后的 schema 正常显示与运行
- 当前本机已接入 gray 的 ComfyUI 实例上，共享工作流是否能完成一次真实提交和输出回收

## 风险与残留问题

- 本轮只完成了 gray 发布和运行态核验，ComfyUI 工作流治理页的最终产品体验仍需要浏览器人工验收
- 当前 production 仍停留在 `v0.5.22`；若本轮 gray 验收通过，后续 production 发布时必须沿用同一批 release 内容继续推进
- 版本漂移的直接根因已定位并修复，但后续每次版本推进仍需优先检查 shared 常量与 dist 产物是否同步

## 回滚信息

- `current` 回滚目标：`/opt/apps/xinghuan-canvas-next/releases/20260703-comfyui-dashboard-redesign-gray-r1-v0522`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
