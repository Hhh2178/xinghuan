# 生成数量能力灰度与生产发布记录

日期: `2026-06-10`

统一 release: `20260610-generation-count-r1-f295040`

对应本机提交: `f295040`

## 发布目标

- 为所有实际发起生成请求的生成类节点补齐 `生成数量` 选择。
- UI 采用与比例等核心参数并排的紧凑布局。
- 前端统一按单次请求自动拆单，再聚合回当前节点，避免依赖不同上游的原生多数量能力。

## 本次覆盖节点

- `ImageNode`
- `VideoNode`
- `AudioNode`
- `SeedanceNode`
- `PresetImageNode`

说明:

- `PresetImageNode` 中：
  - `multi-angle-3d` 会按整组视角重复生成。
  - 其余预设图像节点按单次请求自动拆单并聚合。

## 本机验收

- 构建:
  - `npm run build:single-port`
- 契约:
  - `npm run verify:generation-count-contract`
  - 已覆盖 `Image / Video / Audio / Seedance / PresetImage`
- 单端口:
  - `npm run verify:single-port`
- 静态入口缓存:
  - `npm run verify:static-html-cache-contract`

## 灰度发布

灰度目录:

- `/opt/apps/xinghuan-canvas-next/releases/20260610-generation-count-r1-f295040`

灰度 current:

- `/opt/apps/xinghuan-canvas-next/current`

服务器动作:

- 上传 `/tmp/20260610-generation-count-r1-f295040.tar.gz`
- 解压到灰度 release 目录
- 执行 `npm ci`
- 加载 `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
- 执行 `npm run db:migrate`
  - `applied=[]`
  - `skipped=6`
- 切换 `current`
- 重启:
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

灰度结果:

- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260610-generation-count-r1-f295040`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `curl -fsS http://127.0.0.1:18200/api/status`
  - `environment=gray`
- 公网:
  - `https://canvas-next.hhh2121.xyz/` -> `200`
  - `https://canvas-next.hhh2121.xyz/admin` -> `200`
  - `https://canvas-next.hhh2121.xyz/api/status` -> `environment=gray`
- 公网完整验收:
  - 使用灰度真实引导账号执行 `npm run verify:single-port`
  - 全部通过

## 生产发布

生产目录:

- `/opt/apps/xinghuan-canvas/releases/20260610-generation-count-r1-f295040`

生产 current:

- `/opt/apps/xinghuan-canvas/current`

服务器动作:

- 复用同一份 `/tmp/20260610-generation-count-r1-f295040.tar.gz`
- 解压到生产 release 目录
- 执行 `npm ci`
- 加载 `/opt/apps/xinghuan-canvas/shared/canvas.env`
- 执行 `npm run db:migrate`
  - `applied=[]`
  - `skipped=6`
- 切换 `current`
- 重启:
  - `xinghuan-canvas.service`
  - `xinghuan-canvas-worker.service`

生产结果:

- `readlink -f /opt/apps/xinghuan-canvas/current`
  - `/opt/apps/xinghuan-canvas/releases/20260610-generation-count-r1-f295040`
- `systemctl is-active xinghuan-canvas.service`
  - `active`
- `systemctl is-active xinghuan-canvas-worker.service`
  - `active`
- `curl -fsS http://127.0.0.1:18100/api/status`
  - `environment=production`
- 公网:
  - `https://canvas.hhh2121.xyz/` -> `200`
  - `https://canvas.hhh2121.xyz/admin` -> `200`
  - `https://canvas.hhh2121.xyz/api/status` -> `environment=production`
- 公网完整验收:
  - 使用生产真实引导账号执行 `npm run verify:single-port`
  - 全部通过

## 结论

- 生成类节点的 `生成数量` 能力已经完成，并已同步到灰度和生产。
- 当前灰度与生产使用同一 release：
  - `20260610-generation-count-r1-f295040`
- 本轮没有新增数据库迁移。

## 后续补强记录

时间: `2026-06-10`

补强内容:

- 多产物输出统一进入单个输出集合节点，不再按生成产物拆多个输出节点。
- 输出集合节点采用自适应 contain 网格，节点拖拽改变宽高时只调整排布和缩放，不拉伸、不裁切素材画面。
- 多数量生成采用并发拆单，子任务完成后即时回写当前生成节点；全部 settled 后结束节点任务。
- 生成节点终止入口统一放在节点头部小按钮，底部运行区仅展示轻量状态，避免 UI 混杂。
- 取消链路已具备前端调用与后端端点；当前只确认本地轮询和运行态停止，上游真实取消需后续按服务商协议接入。

灰度/生产关系说明:

- 灰度入口 `canvas-next.hhh2121.xyz` 和生产入口 `canvas.hhh2121.xyz` 当前使用不同端口和 release 目录。
- 两者当前仍共用同一 PostgreSQL 数据底座，所以灰度画布任务可能在生产画布可见，后台 Provider/API 配置也可能共享。
- 如需灰度与生产完全隔离，应拆分 PostgreSQL 数据库或 schema，并拆分 Redis 队列名与任务命名空间。

## 节点尺寸同步与素材布局补丁

时间: `2026-06-10`

修复目标:

- 生成节点运行态/完成态切换后，节点真实高度变化时，React Flow 连线锚点必须同步刷新。
- 输出素材集合节点在窄高比例下，多图/多视频不能被高节点强行拉出巨大上下黑边。

实现:

- 新增 `useSyncNodeInternalsOnResize`。
- 接入 `OutputNode`、`UploadNode`、`ImageNode`、`VideoNode`、`SeedanceNode`、`AudioNode`。
- 多素材网格行高改为按素材实际宽高比计算，并限制最大行高。

验证:

- `npm run verify:output-node-preview-layout`
- `npm run verify:node-resize-sync-contract`
- `npm run build:single-port`
