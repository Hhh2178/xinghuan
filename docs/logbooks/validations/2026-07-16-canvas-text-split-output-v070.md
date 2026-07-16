# v0.7.0 文本分割输出隔离灰度验证

## 本地证据

- 专项回归：4 项通过，覆盖自动生成图和 OutputNode 上游素材隔离。
- 全量测试：35 个测试文件、125 项测试通过。
- Web type-check、Web production build、画布工作流能力契约通过。
- Project、Workspace、Release Harness 与 CodeGraph 同步通过。
- 发布包 SHA-256：`c11dac0f82a4713b8c308f544dd29ff3a00d7f1c997a16612fe112663889cbc8`。

## 运行态证据

- release 指针：`/opt/apps/xinghuan-canvas-next/releases/20260716-canvas-text-split-output-gray-r2-v070`。
- API/Worker：`active / active`。
- 内网与公网状态：`0.7.0 / gray / enforced`。
- 权限数据库：`xinghuan_canvas_gray`。
- 权限 readiness：`ready=true`，metrics 为 `126 / 118 / 7 / 1 / 940 / 4`，failures 为空。

## 验收边界

- 自动化已验证分段数据不会再沿展示连线重复收集源节点全文。
- 登录后的真实画布交互由用户继续在 Gray 验收；需要重新点击“启动”生成新一批输出节点。
- Production 保持 `v0.6.13`，本轮没有生产部署或生产状态写入。

## 结论

- Gray 基础运行态、权限 readiness、版本与环境隔离均通过，可进入文本分割人工体验验收。
