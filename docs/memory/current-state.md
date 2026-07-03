# 当前状态

## 当前版本与阶段

- 当前活跃版本：`v0.5.22`
- 当前灰度 release：`20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前产品路线口径：
  - 早期 `Phase 3` 任务与素材闭环已完成；当前不再用 Phase 3 作为主状态描述
  - 当前重点是 ComfyUI 机器池与工作流治理、项目级 harness、后台体验重设计和发布链路一致性
- 当前多用户正式化治理口径：
  - `Phase A-E` 已完成 gray / production 收口

## 当前环境入口

- 当前 worktree：`D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`
- 灰度：`canvas-next.hhh2121.xyz` / `127.0.0.1:18200`
- 生产：`canvas.hhh2121.xyz` / `127.0.0.1:18100`
- 当前 production 数据库目标：`xinghuan_canvas_next`

## 当前高频系统关注点

- RunningHub：条目建模、Workflow/App 区分、无入参 workflow、AI App v2、空白草稿创建、输出重置
- Admin：系统并发治理、RH 工作台、环境同步
- API：任务接口、系统只读聚合、RunningHub 分析
- Worker：普通任务并发与 RH 平台窗口治理
- Worker 下一步：`worker.ts` 第二阶段收口继续推进
  - 已抽出 RunningHub client 与 poll 解析护栏
  - 下一步继续拆分 dispatch、统一取消同步与更多共享运行态 helper
- 当前工程治理重点：
  - 避免继续制造 `server.ts / worker.ts / RunningHubNode.tsx` 这类超级文件
  - 发布前必须收紧工作树，只保留本轮预期改动
- 当前画布执行链路重点：
  - 组执行管理器已支持持续开关、执行次数和面板内直接开始执行
  - 组内执行按当前连线拓扑串行
  - 多轮执行时每轮都会重新读取当前画布拓扑
- 当前已完成的最新运行态治理：
  - gray / production 当前都已运行在 `v0.5.22`
  - gray 当前 release 为 `20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
  - production 当前 release 为 `20260702-envsync-admin-sections-prod-r1-v0522`
  - ComfyUI connector harness、共享工作流专用执行入口和项目级 harness 入口层已在本地整合分支完成
  - ComfyUI 后台当前体验仍需重新设计，不应把运行态对齐误判为产品体验验收通过

## 相关入口

- 总索引：`../INDEX.md`
- 系统知识：`../systems/README.md`
- 运行态材料：`../../ops/README.md`
