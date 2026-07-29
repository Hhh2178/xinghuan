# Canvas Reset v0.8.6 Gray

- release: `20260729-canvas-reset-v086-r1`
- version: `0.8.6`
- source branch: `release/canvas-reset-gray-v086`
- source commit: `8cdc9204704d9a26d06bbcef61699318d7216bfb`
- archive SHA-256: `6E116AF86FC00D153BC24723A8990166956C95238CCDA918302075E82360D711`
- target: `old-server` / Gray
- rollback: `20260729-canvas-presentation-correction-v085-r1`
- retention apply: `false`

## Scope

- 移除画布旧版/新版切换器、用户级持久化状态和现代点阵/MiniMap/浮层覆盖。
- 保留悬停或键盘焦点展开的 56px/232px 侧栏 rail。
- 移除 Image/Video/LLM 节点与素材预览的 modern marker 和 `node-modern.css`，恢复原节点结构与尺寸。
- 建立 Admin 渐变科技操作台的 Foundation、Audit、Program 和强制文档契约；本 release 不包含 Admin A 批页面代码。

## Verification

- 本地全量测试：217 个文件中 216 通过、1 跳过；842 项中 838 通过、4 跳过。
- Web/Admin 构建、单端口全构建、Release package、视觉文档和 Token 契约通过。
- 旧服务器 Gray API/Worker active；内外状态均为 `0.8.6 / gray`。
- 权限 readiness：`enforced / ready`，132 subjects、125 published、932 rules、5 principals、0 failures。
- 浏览器视觉与真实业务体验仍需在 1920x1080 下人工验收；未部署 Production。

## Preparation Note

首次 prepare 因干净 worktree 未安装开发依赖而缺少 `tsc`，未生成制品、未触碰服务器。使用 `npm install --include=dev` 补齐同一锁文件依赖后重新执行，完整 prepare 通过。
