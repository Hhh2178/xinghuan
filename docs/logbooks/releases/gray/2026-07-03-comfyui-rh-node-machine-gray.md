# 2026-07-03 ComfyUI RH Node Machine Selection (Gray)

## 发布目标

- 将 RH 风格的统一 `comfyui` 节点灰度发布到服务器
- 把共享工作流的机器选择、`displayTier`、`instanceBindings` 和单节点迁移链路一起推上 gray
- 将灰度版本从 `v0.5.23` 推进到 `v0.5.24`

## 发布信息

- 环境：`gray`
- 版本：`v0.5.24`
- release：`20260703-comfyui-rh-node-machine-gray-r1-v0524`
- 上一灰度 release：`20260703-comfyui-workflow-governance-gray-r1-v0523`

## Agent 已验证

### 本地代码与产物

- 已完成统一 `comfyui` 节点重构：
  - 单一可见节点
  - 顶部 `工作流 + 机器` 双选择
  - RH 风格 section 壳层
  - 单外部输出口 + 内部结构化 `outputs`
- 已完成后台治理补强：
  - `displayTier`
  - `instanceBindings`
  - 默认机器 / 可运行机器
  - 共享工作流机器约束执行
- 已通过：
  - `npm run type-check -w @xinghuan/shared`
  - `npm run type-check -w @xinghuan/api`
  - `npm run type-check -w @xinghuan/admin`
  - `npm run type-check -w @xinghuan/web`
  - `npm run harness:verify:comfyui`
  - `npm run verify:project-harness-contract`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run release:gray:prepare -- --release=20260703-comfyui-rh-node-machine-gray-r1-v0524`
- gray 发布包已生成：
  - `dist-release/20260703-comfyui-rh-node-machine-gray-r1-v0524.tar.gz`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260703-comfyui-rh-node-machine-gray-r1-v0524 --archive=dist-release/20260703-comfyui-rh-node-machine-gray-r1-v0524.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260703-comfyui-rh-node-machine-gray-r1-v0524`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.24, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.24, environment gray`

## 待用户验收

### 视觉与交互

- 统一 `comfyui` 节点的图标、标题、工作流下拉、机器下拉、参数 section 是否达到 RH 风格预期
- 后台工作流治理页里的参数层级、机器绑定卡片、默认机器选择是否顺手

### 真实业务链路

- 上传本地 ComfyUI workflow JSON 后，后台是否正确识别输入项、输出项和默认值
- 管理员调整暴露参数、默认值、机器绑定后，前台 `comfyui` 节点是否正确消费
- 在当前 gray 已接入的本机 ComfyUI 实例上，共享工作流是否能完成一次真实执行并正确回收主输出

## 风险与残留问题

- 当前只完成了代码层、发布层和运行态层验证，最终体验仍需浏览器人工验收
- production 仍停留在 `v0.5.22`；若这轮 gray 验收通过，后续 production 需要沿用本批 `v0.5.24` 内容继续推进
- `Canvas.tsx` 仍是热点文件，虽然本轮已把 ComfyUI 节点拆到 section / helper 层，但后续还应继续收口

## 回滚信息

- `current` 回滚目标：`/opt/apps/xinghuan-canvas-next/releases/20260703-comfyui-workflow-governance-gray-r1-v0523`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
