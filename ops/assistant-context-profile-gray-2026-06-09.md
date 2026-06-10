# AI 助手上下文与 Profile 灰度记录

日期: 2026-06-09

灰度域名: `canvas-next.hhh2121.xyz`

灰度端口: `127.0.0.1:18200`

Release:

- 本机包: `dist-release/20260609-async-assistant-context-profile-gray.tar.gz`
- 服务器目录: `/opt/apps/xinghuan-canvas-next/releases/20260609-async-assistant-context-profile-gray`
- 当前指针: `/opt/apps/xinghuan-canvas-next/current`

## 变更摘要

- AI 助手请求增加 `conversationId`，后端按会话复用 Hermes session。
- Hermes 接入增加独立 Profile 字段，默认 Profile ID 为 `canvas-assistant`。
- Hermes Profile ID 已从中文展示名修正为可被 Hermes 接受的 ASCII slug: `canvas-assistant`。
- 默认关闭持久记忆，画布侧强制不持久化记忆。
- 附件上下文改为摘要，不再把完整 payload 送入 prompt。
- 后台助手设置保存改为单表 upsert，避免整库重写导致锁冲突。
- 后台 Provider/API 设置页增加 AI 协助配置草案，管理员确认后才回填表单。

## 本机验证

- `npm run verify:admin-assistant-settings-save-contract`
- `npm run verify:admin-assistant-chat`
- `npm run verify:canvas-assistant-chat`
- `npm run verify:admin-assistant-workbench`
- `npm run verify:admin-assistant-ui-contract`
- `npm run verify:canvas-assistant-ui-contract`
- `npm run verify:admin-api-layout-contract`
- `npm run type-check`
- `npm run build:single-port`
- `npm run verify:single-port`

## 服务器验证

- `npm run db:migrate`
  - `applied=[]`
  - `skipped=6`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260609-async-assistant-context-profile-gray`
- `curl -fsS http://127.0.0.1:18200/api/status`
  - 返回 `environment=gray`
- 服务器内联 smoke:
  - `PASS status gray api`
  - `PASS admin login`
  - `PASS admin assistant chat`
  - `PASS canvas assistant chat`
  - `PASS assistant audit`

## 公网验证

- `https://canvas-next.hhh2121.xyz/api/status`
  - `200`
- `https://canvas-next.hhh2121.xyz/`
  - `200`
- `https://canvas-next.hhh2121.xyz/admin`
  - `200`

## 回滚

若需要回滚，将 `current` 指回上一 release，并重启灰度服务:

```bash
ln -sfn /opt/apps/xinghuan-canvas-next/releases/20260609-152648-canvas-assistant-ui-gray /opt/apps/xinghuan-canvas-next/current
sudo systemctl restart xinghuan-canvas-next.service
sudo systemctl restart xinghuan-canvas-next-worker.service
```

回滚后验证:

```bash
curl -fsS http://127.0.0.1:18200/api/status
curl -fsS http://127.0.0.1:18200/
systemctl is-active xinghuan-canvas-next.service
systemctl is-active xinghuan-canvas-next-worker.service
```

## 注意事项

- 不修改生产域名 `canvas.hhh2121.xyz`。
- 不修改内部代理项目服务。
- 不记录真实密钥、Token、Cookie、SSH Key 或数据库密码。
- 已通过 Hermes WebUI `/api/profiles` 与 session 列表确认 Profile 真隔离；持久记忆仍默认关闭。

## 2026-06-09 追加验收: Profile 真隔离

新增 release:

- 本机包: `dist-release/20260609-hermes-canvas-assistant-profile-gray.tar.gz`
- 服务器目录: `/opt/apps/xinghuan-canvas-next/releases/20260609-hermes-canvas-assistant-profile-gray`
- 当前指针: `/opt/apps/xinghuan-canvas-next/current`

修正:

- Hermes Profile ID 固定为 `canvas-assistant`。
- 中文 `无限画布AI助手` 只作为展示身份和文档描述，不作为 Hermes profile id。
- API 与后台默认值均改为 `canvas-assistant`，灰度 env 已配置 `XINGHUAN_HERMES_PROFILE=canvas-assistant`。
- 画布助手保持非持久化记忆；后台助手只有在配置开关明确打开时才允许持久化。

本机验证:

- `npm run verify:admin-assistant-chat`
- `npm run verify:canvas-assistant-chat`
- `npm run verify:admin-assistant-settings-save-contract`
- `npm run type-check`
- `npm run build:single-port`
- `npm run package:release -- 20260609-hermes-canvas-assistant-profile-gray`

服务器验证:

- `npm ci`
  - `found 0 vulnerabilities`
- `npm run db:migrate`
  - `applied=[]`
  - `skipped=6`
- `readlink -f /opt/apps/xinghuan-canvas-next/current`
  - `/opt/apps/xinghuan-canvas-next/releases/20260609-hermes-canvas-assistant-profile-gray`
- `systemctl is-active xinghuan-canvas-next.service`
  - `active`
- `systemctl is-active xinghuan-canvas-next-worker.service`
  - `active`
- 服务器内联 smoke:
  - `status_environment gray`
  - `admin_login pass`
  - `admin_mode hermes len 180`
  - `canvas_login pass`
  - `canvas_mode hermes len 95`

Hermes Profile 验证:

- `profile_exists yes`
- recent sessions:
  - `e454cc81ab0f canvas-assistant deepseek-v4-flash new_release`
  - `bebb52f1ee71 canvas-assistant deepseek-v4-flash new_release`
  - `ea23b53292bb canvas-assistant deepseek-v4-flash new_release`
  - `90b3f3a3f47f canvas-assistant deepseek-v4-flash new_release`

公网验证:

- `https://canvas-next.hhh2121.xyz/api/status`
  - `200`
- `https://canvas-next.hhh2121.xyz/`
  - `200`
- `https://canvas-next.hhh2121.xyz/admin`
  - `200`

回滚:

若需要回滚到上一版助手上下文 release:

```bash
ln -sfn /opt/apps/xinghuan-canvas-next/releases/20260609-async-assistant-context-profile-gray /opt/apps/xinghuan-canvas-next/current
sudo systemctl restart xinghuan-canvas-next.service
sudo systemctl restart xinghuan-canvas-next-worker.service
```
