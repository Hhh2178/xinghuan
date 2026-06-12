# Phase 2 灰度验收记录 - 2026-06-06

## 目标

- 完成 Phase 2 节点与模型治理灰度验收。
- 验证后台 Provider/模型框架、三类通用节点、动态参数、后端代理、Worker 图像 Adapter 和公网画布真实联通。
- 保持服务商 Key 不进入文档、Git、日志和截图。

## Release

- Release ID: `20260606-0945-phase2-complete-gray`
- 灰度域名: `https://canvas-next.hhh2121.xyz`
- 服务端口: `127.0.0.1:18200`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`
- 存储驱动: `postgres`
- Redis 队列: `xinghuan:tasks`

## 变更范围

- 后台模型高级设置：
  - 显示名
  - 模型 ID
  - 能力分类
  - 协议覆盖
  - 输入 Profile
  - 参数 Schema JSON
- 画布通用节点：
  - 图像节点读取后台 image 模型并动态渲染比例、尺寸、参考图上限。
  - 视频节点读取后台 video 模型并动态渲染比例、时长、分辨率、参考图上限。
  - LLM 节点读取后台 chat 模型并通过后端代理请求。
  - 图像/视频节点在 schema 更新后自动归一化旧参数。
- 后端代理：
  - `/api/proxy/external/image`
  - `/api/proxy/external/llm`
  - `/api/proxy/external/video`
- Worker：
  - 图像 Adapter 读取 Provider/Model/Key/payload。
  - 修复 API 写任务日志时覆盖 Worker 状态的竞态。

## 自动验收

服务器在 `/opt/apps/xinghuan-canvas-next/current` 执行并全部通过：

- `npm run verify:single-port`
- `npm run verify:model-catalog`
- `npm run verify:external-image-proxy`
- `npm run verify:external-chat-proxy`
- `npm run verify:external-video-proxy`
- `npm run verify:generic-node-catalog`
- `npm run verify:task-payload-api`
- `npm run verify:worker-adapter-contract`
- `npm run verify:worker-image-adapter`
- `npm run verify:worker`

本机补充验证：

- `npm run type-check -w @xinghuan/web`
- `npm run type-check -w @xinghuan/admin`
- `npm run build:single-port`
- `npm run verify:model-catalog`
- `npm run verify:generic-node-catalog`

## 公网视觉和操控验收

- 公网后台 `/admin` 可登录并打开 API 设置。
- Provider 列表、Provider 编辑器、模型三分类和模型高级设置均为科技风深色管理台样式。
- 窄屏后台可纵向浏览，关键按钮和状态信息可见。
- 公网画布保留 T8 成熟无限画板 UI，默认科技风。
- Phase 2 验收画布包含真实连线：
  - Text -> Image
  - Text -> Video
  - Text -> LLM
- 图像节点生成成功，输出 `/files/output/external_image_...png`。
- 视频节点生成成功，输出 `/files/output/external_video_...mp4`。
- LLM 节点运行成功，返回 `Phase 2 LLM 节点连通成功`。
- 后台保存新图像 schema 后，画布图像节点显示：
  - 比例：`3:4`
  - 尺寸：`800x1200`
  - 输入 Profile：`prompt,image_reference,multi_image`
  - 参考图上限：`图像 (0/5)`
- 再次点击图像生成成功，浏览器控制台 0 error。

## 截图证据

- `output/playwright/phase2-gray-public-after.png`
- `output/playwright/phase2-gray-admin-api-desktop.png`
- `output/playwright/phase2-gray-admin-api-narrow.png`
- `output/playwright/phase2-gray-model-advanced-editor.png`
- `output/playwright/phase2-gray-dynamic-schema-after-admin-edit.png`

## 当前结论

Phase 2 已完成灰度验收。后台模型治理、三类通用节点、动态参数和真实联通可作为后续 Phase 3 的基础。

## 后续动作

- 进入 Phase 3：任务输出素材落库和资源库联动。
- 将画布内容和素材资源库迁移到 PostgreSQL repository。
- 继续细化 RunningHub 工作流字段映射、工作流 JSON 拉取和预览运行。
- 准备生产域名 `canvas.hhh2121.xyz` 与端口 `127.0.0.1:18100` 的切换方案。
