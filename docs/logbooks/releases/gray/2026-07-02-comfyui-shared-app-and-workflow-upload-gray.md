# ComfyUI Shared App and Workflow Upload Gray Release - 2026-07-02

## 状态

- 环境：`gray`
- 版本：`v0.5.22`
- release：`20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前状态：`2026-07-02 已完成 gray deploy + runtime verify`
- 上一灰度 release：`20260630-performance-toggle-and-import-fixes-gray-r1-v0520`

## 发布目标

- 修复公共资源库上传本地工作流 JSON 时只能识别旧 manifest、无法直接接收画布导出 `nodes/edges` JSON 的问题。
- 将后台已发布到共享区的 ComfyUI 工作流暴露给画布，新增只消费后台共享目录的 `ComfyUI应用` 节点。
- 保证灰度环境对外版本号、后端状态接口、共享版本常量统一对齐到 `v0.5.22`。

## 变更范围

- `apps/web/src/utils/workflowResource.ts`
  - 工作流资源解析兼容原始 `nodes/edges` 画布 JSON，不再只接受 `t8-workflow-fragment`。
- `apps/web/src/components/ResourceLibraryDrawer.tsx`
  - 上传公共工作流时先归一化为标准 workflow manifest，再写入公共资源库。
- `apps/api/src/comfyui-public-routes.ts`
  - 新增 `GET /api/comfyui/apps`，向画布公开共享 ComfyUI 工作流目录。
- `apps/web/src/components/nodes/ComfyUIApplicationNode.tsx`
  - 新增共享 ComfyUI 消费节点，只显示后台暴露参数和输出。
- `apps/web/src/components/Canvas.tsx`
  - 注册 `comfyui-app` 节点并补齐默认运行态数据。
- `apps/web/src/config/nodeRegistry.ts`
  - 侧边栏新增 `ComfyUI应用` 节点入口。
- `apps/web/src/config/portTypes.ts`
  - 为 `comfyui-app` 注册四类素材输入输出端口。
- `apps/web/src/utils/comfyuiApps.ts`
  - 新增共享目录工作流到前端运行定义的转换 helper。
- `apps/web/src/components/nodes/LoopNode.tsx`
  - 循环器执行集合纳入 `comfyui-app`。
- `packages/shared/src/index.ts`
  - `appVersion` 从 `0.5.20` 对齐到 `0.5.22`。

## Agent 已验证

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/web`
- `node scripts/verify-comfyui-instance-pool-contract.mjs`
- `npm run verify:quick`
- `npx tsx -e "workflowManifestToFragment({ nodes:[...], edges:[] })"` 等价行为验证
- `npm run release:gray:prepare -- --release=20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- `npm run release:gray:deploy -- --release=20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522 --archive=dist-release/20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem`
- `npm run release:gray:verify -- --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.5.22 --expected-environment=gray`

## 运行态结果

- 当前 gray release：
  - `/opt/apps/xinghuan-canvas-next/releases/20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前服务：
  - `xinghuan-canvas-next.service = active`
  - `xinghuan-canvas-next-worker.service = active`
- 当前状态接口：
  - `https://canvas-next.hhh2121.xyz/api/status`
  - `http://127.0.0.1:18200/api/status`
- 结果：
  - `version = 0.5.22`
  - `environment = gray`
  - `dataDir = /opt/apps/xinghuan-canvas-next/shared/data`

## 待用户验收

- 公共资源库的“工作流”分类中，上传本地画布导出 JSON 后是否能成功入库并再次插回画布。
- 画布侧边栏新增的 `ComfyUI应用` 节点，是否能看到后台已推送到共享区的工作流。
- 选中共享 ComfyUI 工作流后，暴露参数、上游素材输入、运行输出是否符合预期。

## 风险

- 当前 `ComfyUI应用` 节点仍走现有 ComfyUI 执行适配链，机器注册 / 心跳 connector 还未在本批次内自动化落地。
- 旧 `ComfyUI超市` 本地路径仍保留为兼容入口，后续还需要继续收口到共享目录治理模型。
