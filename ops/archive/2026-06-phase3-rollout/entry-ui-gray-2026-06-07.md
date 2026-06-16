# 入口 UI 设计稿灰度发布记录 - 2026-06-07

## 目标

- 将用户提供的 `stitch_ui_optimization_and_transitions` 入口设计稿落地到灰度。
- 确认 `canvas-next.hhh2121.xyz` 展示新的居中磨玻璃登录页。
- 确认启动过渡页使用星幻量子同步语义，不再出现旧 T8 或开发占位文案。

## Release

- Release ID：`20260607-entrance-ui-gray`
- 目标目录：`/opt/apps/xinghuan-canvas-next/releases/20260607-entrance-ui-gray`
- 当前指针：`/opt/apps/xinghuan-canvas-next/current`
- 灰度入口：`https://canvas-next.hhh2121.xyz`
- 本机端口：`127.0.0.1:18200`

## 发布动作

- 从当前 worktree 打包 release，排除 `.git`、`.env*`、`.tmp`、`.codegraph`、依赖目录、构建产物、运行数据和输出目录。
- 上传 `/tmp/20260607-entrance-ui-gray.tgz`。
- 服务器执行 `npm ci`，结果 `0 vulnerabilities`。
- 服务器执行 `npm run build:single-port`，Web/Admin 构建通过；仍存在既有大 chunk 和空 `vendor-react` chunk 警告。
- 切换 `current` 到新 release。
- 重启 `xinghuan-canvas-next.service` 和 `xinghuan-canvas-next-worker.service`。

## 验收结果

- `readlink -f /opt/apps/xinghuan-canvas-next/current` 返回新 release。
- `systemctl is-active xinghuan-canvas-next` 返回 `active`。
- `systemctl is-active xinghuan-canvas-next-worker` 返回 `active`。
- `curl http://127.0.0.1:18200/api/status` 返回 `environment=gray`。
- 服务器灰度已通过：
  - `npm run verify:xinghuan-entry-ui`
  - `npm run verify:single-port`
- 公网浏览器验收通过：
  - URL：`https://canvas-next.hhh2121.xyz/`
  - DOM 包含 `星幻画布`、`XingHuan Canvas`、`进入创作星域`、`量子星图系统已就绪`。
  - DOM 不包含 `SSO 接入`、`组织网络`、`STELLAR GRAPH WARMUP`。
  - 控制台 error 数量为 0。
  - 截图：`output/xinghuan-entry-ui/gray-login-desktop.png`。

## 结论

灰度 release `20260607-entrance-ui-gray` 已上线并通过入口 UI、单端口和公网视觉验收。生产域名暂未切换。
