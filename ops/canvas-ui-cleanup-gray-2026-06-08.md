# 画布 UI 清理灰度记录 - 2026-06-08

## 目标

- 移除画布中的主题音乐播放能力与相关入口。
- 将磁吸开关默认值调整为关闭。
- 保持灰度入口 `canvas-next.hhh2121.xyz`、单端口 `127.0.0.1:18200` 与 Worker 服务持续可用。

## Release

- Release ID: `20260608-185550-canvas-ui-cleanup-gray`
- 灰度域名: `https://canvas-next.hhh2121.xyz`
- 服务端口: `127.0.0.1:18200`
- API 服务: `xinghuan-canvas-next.service`
- Worker 服务: `xinghuan-canvas-next-worker.service`
- 当前 release 路径: `/opt/apps/xinghuan-canvas-next/releases/20260608-185550-canvas-ui-cleanup-gray`

## 变更范围

- `apps/web/src/components/Canvas.tsx`
  - 删除画布悬浮控制区中的主题音乐按钮。
  - 将 `snapEnabled` 初始值由 `true` 调整为 `false`。
- `apps/web/src/components/ThemeTemplateManager.tsx`
  - 删除“默认音乐主题”配置区与音频上传入口。
- `apps/web/src/components/ThemeMusicToggle.tsx`
  - 删除独立音乐播放组件。
- `apps/web/src/styles/index.css`
  - 清理主题音乐按钮样式。
  - 将模型注意事项面板改为固定定位，避免受已删除按钮布局影响。
- 主题样式文件：
  - `theme-op.css`
  - `theme-rh.css`
  - `theme-naruto.css`
  - `theme-eva.css`
  - `theme-yyh.css`
  - `theme-slamdunk.css`
  - `theme-soccer.css`
  - 同步移除各主题下对音乐按钮的覆盖样式。

## 本机验证

通过：

- `npm run verify:canvas-audio-ui-removal`
- `npm run verify:single-port`
- `npm run build:single-port`

额外确认：

- 当前画布页按钮文案为“开启网格吸附 + 对齐辅助线”，说明磁吸默认状态为关闭。
- 当前画布页不存在音乐播放按钮与 `.t8-theme-music-toggle` 相关节点。

## 服务器部署动作

- 本机打包 release：`releases/20260608-185550-canvas-ui-cleanup-gray.tar.gz`
- 上传到服务器：`/tmp/20260608-185550-canvas-ui-cleanup-gray.tar.gz`
- 解压到：
  - `/opt/apps/xinghuan-canvas-next/releases/20260608-185550-canvas-ui-cleanup-gray`
- 在 release 目录执行：
  - `npm ci`
  - `npm run build:single-port`
  - `set -a; . /opt/apps/xinghuan-canvas-next/shared/canvas-next.env; set +a; npm run db:migrate`
- 切换 `/opt/apps/xinghuan-canvas-next/current` 到新 release。
- 重启：
  - `xinghuan-canvas-next.service`
  - `xinghuan-canvas-next-worker.service`

## 灰度验收

公网 smoke 通过：

- `https://canvas-next.hhh2121.xyz/` 返回 `200`
- `https://canvas-next.hhh2121.xyz/admin` 返回 `200`
- `https://canvas-next.hhh2121.xyz/api/status` 返回 `200`
- `/api/status` 返回 `environment=gray`

服务器本地通过：

- `curl http://127.0.0.1:18200/` 返回 `200`
- `curl http://127.0.0.1:18200/admin` 返回 `200`
- `curl http://127.0.0.1:18200/api/status` 返回 `ok`
- `readlink -f /opt/apps/xinghuan-canvas-next/current` 指向本次 release
- `systemctl is-active xinghuan-canvas-next.service` 返回 `active`
- `systemctl is-active xinghuan-canvas-next-worker.service` 返回 `active`

## 注意事项

- 服务器上的 `verify:single-port` 在本次灰度环境未全绿，原因不是服务不可用，而是灰度环境中的管理员引导账号密码已被更新，脚本默认口令与服务器环境中当前口令不一致，导致登录步骤返回 `401 INVALID_CREDENTIALS`。
- 本次上线不涉及内部代理服务、路由和端口修改。

## 当前结论

本轮画布 UI 清理已经完成灰度发布。音乐播放入口已移除，磁吸默认值已切换为关闭，灰度主站、后台入口、状态接口和双服务进程均正常。
