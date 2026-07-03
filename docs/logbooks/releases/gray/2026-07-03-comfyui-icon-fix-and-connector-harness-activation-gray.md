# 2026-07-03 ComfyUI Icon Fix & Connector Harness Activation (Gray)

## 背景

在 `20260703-comfyui-dashboard-redesign-gray-r1-v0522` 部署完成、等待用户浏览器验收期间，
用户反馈两个问题：

1. ComfyUI 相关后台图标风格不统一（"图标比较乱"）
2. 希望把本机 ComfyUI 实例接入灰度后台，但灰度概览页显示 0 台机器

排查发现这不是单纯的视觉问题和"尚未连接"，而是两个实际缺陷：

- CSS 层面：新增的 `.error-banner` 规则与全局既有同名选择器冲突，覆盖了全站错误提示条样式；
  部分按钮圆角/图标尺寸未对齐全站设计规范
- 后端层面：早些时候的增量部署未包含重新构建的 `apps/api/dist`，导致灰度服务器上运行的
  `comfyui-instance-routes.js` 缺失 connector 注册/心跳路由，`XINGHUAN_COMFYUI_CONNECTOR_TOKEN`
  也从未在灰度 env 中配置——即便前端页面正常渲染，本机 connector 实际上无法注册成功

## 本次变更

### 前端 CSS（本地 Git 已提交）

- `apps/admin/src/styles.css`
  - 删除与全局冲突的重复 `.error-banner` 规则
  - 统一 ComfyUI 相关按钮圆角为 `8px`（对齐全站按钮规范）
  - 统一 `admin-comfyui-instance-card__footer button svg` 图标尺寸为 `16px`

### 服务端构建产物（增量部署，未纳入 Git）

- 本地 `npm run build:single-port` 重新构建 `apps/api/dist`、`apps/admin/dist`
- 上传覆盖灰度服务器 `current` release 目录下的 `apps/api/dist`、`apps/admin/dist`

### 灰度服务器环境变量

- `canvas-next.env` 新增 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN=<随机生成共享密钥>`
- 原文件已备份：`canvas-next.env.bak-<timestamp>-add-comfyui-connector-token`

## 部署步骤

1. `ssh -i "D:\codex\服务器\Tencent_Cloud_Server.pem" -p 728 ubuntu@101.33.75.38`
2. 备份并追加 `XINGHUAN_COMFYUI_CONNECTOR_TOKEN` 到
   `/opt/apps/xinghuan-canvas-next/shared/canvas-next.env`
3. 本地重新构建：`npm run build:single-port`
4. 打包 `apps/api/dist`、`apps/admin/dist` 为 tar.gz，`scp` 上传至服务器 `/tmp/`
5. 解压覆盖 `/opt/apps/xinghuan-canvas-next/current/apps/{api,admin}/dist`
6. `sudo systemctl restart xinghuan-canvas-next`
7. 验证 `/api/status`、`/api/internal/comfyui/connectors/register`（带 token）返回 `200`
8. 清空验证过程中产生的测试实例记录（`comfyui-instance-pool.json` 恢复为空实例列表）

## 验证结果

- ✅ `apps/admin` 本地 `tsc --noEmit && vite build` 通过
- ✅ 灰度内网/公网 `/api/status` 均返回 `version=0.5.22, environment=gray`
- ✅ 补齐 dist 前：connector 注册请求返回 `403 CSRF_ORIGIN_REQUIRED`（路由未命中）
- ✅ 补齐 dist 后：connector 注册请求返回 `200`，实例正确写入注册表
- ✅ 测试数据已清理，`comfyui-instance-pool.json` 恢复为空
- ✅ `xinghuan-canvas-next` 服务重启后状态 `active`

## 07-03 补充：本机真实实例接入完成

在上述“gray 具备 connector 注册/心跳能力”基础上，随后完成了当前这台本机 ComfyUI 的真实接入：

- 本机 ComfyUI 仍运行在 `http://127.0.0.1:8188`
- 由于 gray 服务器当前不能直接依赖 tailnet 访问本机，实际采用 SSH 反向隧道：
  - gray `127.0.0.1:28188` -> local `127.0.0.1:8188`
- connector 新增 `XINGHUAN_COMFYUI_REGISTER_BASE_URL` 支持：
  - 本机探活继续使用 `XINGHUAN_COMFYUI_BASE_URL=http://127.0.0.1:8188`
  - 后台注册地址单独使用 `XINGHUAN_COMFYUI_REGISTER_BASE_URL=http://127.0.0.1:28188`

补充验证:

- ✅ 本机 `GET /system_stats` 返回 `comfyui_version=0.27.0`
- ✅ gray 服务器 `curl http://127.0.0.1:28188/system_stats` 返回真实 ComfyUI JSON
- ✅ gray 实例池注册表中出现在线实例：
  - `id=comfyui-chinami-lrlmfij-gray`
  - `name=Local ComfyUI CHINAMI-LRLMFIJ`
  - `baseUrl=http://127.0.0.1:28188`
  - `health=online`
- ✅ connector 日志持续输出 `heartbeat ok`

## 回滚方案

```bash
ssh -i "D:\codex\服务器\Tencent_Cloud_Server.pem" -p 728 ubuntu@101.33.75.38
cd /opt/apps/xinghuan-canvas-next/shared
cp canvas-next.env.bak-<timestamp>-add-comfyui-connector-token canvas-next.env
sudo systemctl restart xinghuan-canvas-next
```

前端 dist 如需回滚，可从 `20260702-comfyui-shared-app-and-workflow-upload-gray-r1-v0522`
release 目录复制对应 `apps/api/dist`、`apps/admin/dist` 覆盖回 `current`。

## 后续

- 浏览器侧继续验收 ComfyUI 后台实例卡片、详情页与后续工作流执行链路
- 如需长期保活，补一本机 connector + 反向隧道的固定运维脚本/服务化入口
- 下一次 production 发布时需确认这批 dist 修复内容同步覆盖，避免生产环境出现同样的
  "源码已提交、构建产物未同步"问题
