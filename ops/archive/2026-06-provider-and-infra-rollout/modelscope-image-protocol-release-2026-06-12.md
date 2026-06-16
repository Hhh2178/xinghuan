# ModelScope 图像协议修复发布记录

日期：`2026-06-12`

## 发布目标

- 修复魔搭图像模型在正式环境中被误套进 `APIMart` 图像异步链路的问题。
- 将 `ModelScope` 图像能力升级为明确协议分支，并补齐图像编辑参考图与输出素材落地兼容。
- 使用 `Agnes + 魔搭` 在灰度与正式执行真实任务验收。

## 本地前置验证

- `npm run type-check -w @xinghuan/api`
- `npm run type-check -w @xinghuan/worker`
- `npm run verify:modelscope-image-adapter-contract`
- `npm run verify:provider-generation-task-service`
- `npm run verify:provider-generation-worker`
- `npm run build:single-port`

结果：

- 全部通过

## 灰度发布链路

灰度相关 release：

- `20260612-modelscope-image-protocol-gray-r1`
- `20260612-modelscope-image-edit-fix-gray-r2`
- `20260612-modelscope-image-materialize-fix-gray-r3`

当前灰度指针：

- `/opt/apps/xinghuan-canvas-next/current -> /opt/apps/xinghuan-canvas-next/releases/20260612-modelscope-image-materialize-fix-gray-r3`

灰度服务状态：

- `xinghuan-canvas-next.service = active`
- `xinghuan-canvas-next-worker.service = active`

灰度运行态证据：

- API dist 包含：
  - `X-ModelScope-Async-Mode`
  - `api-inference.modelscope.cn`
- Worker dist 包含：
  - `X-ModelScope-Task-Type`
  - `modelscope-image`

## 灰度真实验收

验收方式：

- 登录灰度 `127.0.0.1:18200`
- 使用真实已配置 Provider：
  - `Agnes / agnes-image-2.1-flash`
  - `魔搭 / Qwen/Qwen-Image-Edit`

验收结果：

- 单任务：
  - `Agnes` 图像生成成功
  - `魔搭 Qwen/Qwen-Image-Edit` 在传入参考图后成功
- 混合并发：
  - `2 Agnes + 2 魔搭` 同批提交，4 个任务全部成功
- 任务结果：
  - 魔搭任务 `raw.adapter = modelscope-image`
  - 输出素材已落地 `/files/output/...`

灰度中间根因记录：

- 第一次魔搭失败：
  - 原因：使用了 `Qwen-Image-Edit` 但未传参考图
  - 上游报错：`requires image upload`
- 第二次魔搭失败：
  - 原因：上游真实图片下载返回 `application/octet-stream`
  - 本地素材落地误判“不是图片”
- 当前已修复：
  - `image / images / image_url / image_urls` 参考图兼容
  - 对扩展名明确为图片的 `application/octet-stream` 受控放宽保存

## 正式发布链路

正式 release：

- `20260612-modelscope-image-protocol-prod-r2`

当前正式指针：

- `/opt/apps/xinghuan-canvas/current -> /opt/apps/xinghuan-canvas/releases/20260612-modelscope-image-protocol-prod-r2`

正式服务状态：

- `xinghuan-canvas.service = active`
- `xinghuan-canvas-worker.service = active`

正式真实验收：

- 登录正式 `127.0.0.1:18100`
- 使用真实已配置 Provider：
  - `Agnes / agnes-image-2.1-flash`
  - `魔搭 / Qwen/Qwen-Image-Edit`
- 结果：
  - `Agnes` 图像生成成功
  - `魔搭 Qwen/Qwen-Image-Edit` 成功
  - 正式任务进入 `xinghuan:tasks:prod:image`
  - 魔搭任务 `raw.adapter = modelscope-image`

## 当前结论

- `ModelScope` 图像协议已在灰度和正式恢复可用。
- 魔搭图像模型不再误走 `APIMart` 图像异步链路。
- 图像编辑模型的参考图输入与输出素材落地兼容已经补齐。

## 后续规范

- 新接图像平台时，先判断是：
  - 文生图
  - 图像编辑
- 再决定协议分支，避免先强行挂在 `openai / apimart` 下面。
- 上线前至少做三类真实验收：
  - 单任务
  - 参考图任务
  - 混合并发任务
