# v0.7.0 画布工作流能力灰度验收

## 本地证据

- 全量测试：30 个测试文件、112 项测试通过。
- focused tests：17 项通过。
- `npm run build`、project/workspace Harness、CodeGraph 同步与版本对齐门禁通过。
- Lint 0 error，保留 200 条既有 warning。
- 灰度准备链通过并生成可部署归档。

## 运行态证据

- release 指针：`/opt/apps/xinghuan-canvas-next/releases/20260716-canvas-workflow-capabilities-gray-r1-v070`。
- API/Worker：`active / active`。
- 内网与公网状态：`0.7.0 / gray / enforced`。
- 数据库迁移：无新增迁移，22 项已存在。
- 权限数据库：`xinghuan_canvas_gray`。
- 权限 readiness：`ready=true`，metrics 为 `126 / 117 / 9 / 0 / 932 / 4`，failures 为空。
- 公网页面可达并显示登录界面；标题正确，控制台 0 error / 0 warning。

## 验收边界

- 未使用真实业务账号，未调用付费生成模型。
- 登录后的代码节点、标签节点、模板插入、组循环/重试、文本分割与锁定交互由用户继续进行灰度体验验收。
- Production 保持 `v0.6.13`，本轮没有生产部署或生产状态写入。

## 结论

- 灰度基础运行态、权限 readiness、版本与环境隔离均通过，可进入人工灰度体验阶段。
