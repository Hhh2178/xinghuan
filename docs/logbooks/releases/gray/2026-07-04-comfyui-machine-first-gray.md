# 2026-07-04 ComfyUI Machine-First Node Gray Release

## 发布目标

- 将统一 `comfyui` 节点的选择层级改为 `先机器、后工作流`
- 去掉节点内部滚动，让参数区按内容自动拉长展示
- 收口 ComfyUI 共享执行链路的错误提示，避免前台只看到裸 `fetch failed`
- 将灰度版本从 `v0.5.24` 推进到 `v0.5.25`

## 发布信息

- 环境：`gray`
- 版本：`v0.5.25`
- release：`20260704-comfyui-machine-first-gray-r1-v0525`
- 上一灰度 release：`20260703-comfyui-rh-node-machine-gray-r1-v0524`

## Agent 已验证

### 本地代码与产物

- 已完成统一 `comfyui` 节点 machine-first 收口：
  - 机器优先的共享 workflow 分组
  - 当前机器上下文内的 workflow 选择
  - 节点自动增高，取消内部滚动条
  - 运行前离线机器拦截
- 已完成后端错误翻译补强：
  - 图片上传阶段
  - prompt 提交阶段
  - history 拉取阶段
  - 输出保存阶段
- 已通过：
  - `node scripts/verify-comfyui-unified-node-contract.mjs`
  - `npx tsx scripts/verify-comfyui-public-route-errors.ts`
  - `npx tsx scripts/verify-comfyui-execution-helpers.ts`
  - `npm run type-check -w @xinghuan/web`
  - `npm run type-check -w @xinghuan/api`
  - `npm run harness:verify:comfyui`
  - `node scripts/verify-release-version-alignment.mjs`
  - `npm run build:single-port`
  - `npm run release:gray:prepare -- --release=20260704-comfyui-machine-first-gray-r1-v0525 --verify="npm run harness:verify:comfyui"`
- gray 发布包已生成：
  - `dist-release/20260704-comfyui-machine-first-gray-r1-v0525.tar.gz`

### 远端部署与运行态

- 已执行：
  - `npm run release:gray:deploy -- --release=20260704-comfyui-machine-first-gray-r1-v0525 --archive=dist-release/20260704-comfyui-machine-first-gray-r1-v0525.tar.gz --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem`
  - `npm run release:gray:verify -- --ssh-key=D:\codex\服务器\Tencent_Cloud_Server.pem --expected-version=0.5.25 --expected-environment=gray`
- 远端 current 指针：
  - `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260704-comfyui-machine-first-gray-r1-v0525`
- 服务状态：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 运行态验证：
  - `https://canvas-next.hhh2121.xyz/api/status => version 0.5.25, environment gray`
  - `http://127.0.0.1:18200/api/status => version 0.5.25, environment gray`
- 补充说明：
  - 首次 gray verify 命中了服务重启窗口，短暂读到旧的 `0.5.24` 状态
  - 随后通过 SSH 复核 `current` 指针、systemd 进程和内网 `/api/status`，确认服务实际已切到 `20260704-comfyui-machine-first-gray-r1-v0525`
  - 第二次标准 verify 已完整通过

## 待用户验收

### 视觉与交互

- 统一 `comfyui` 节点现在是否符合“先机器、后工作流”的真实使用习惯
- 参数较多的 workflow 在画布中是否已不再出现内部滚动条，整体视觉层级是否可接受

### 真实业务链路

- 切换不同机器后，workflow 列表是否只展示该机器可用的共享 workflow
- 选择本机已接入的 ComfyUI 实例后，共享 workflow 是否能完成一次真实执行并正确回收主输出
- 当机器不可达或执行链路异常时，前台错误是否已从裸 `fetch failed` 变成可操作提示

## 风险与残留问题

- 当前已完成代码层、打包层、部署层和运行态层验证，最终交互体验仍需浏览器人工验收
- production 仍停留在 `v0.5.22`；若本轮 gray 验收通过，后续 production 需要沿用本批 `v0.5.25` 内容继续推进
- `Canvas.tsx` 仍属于热点文件；虽然本轮把 ComfyUI 的机器优先逻辑继续下沉到 helper，但前端热点拆分仍需后续继续推进

## 回滚信息

- `current` 回滚目标：`/opt/apps/xinghuan-canvas-next/releases/20260703-comfyui-rh-node-machine-gray-r1-v0524`
- 需要重启的服务：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`
- 回滚后需复查的接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
