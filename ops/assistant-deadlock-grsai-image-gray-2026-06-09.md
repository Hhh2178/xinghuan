# AI 助手 deadlock / GRSAI / 图片输入 灰度记录

日期: 2026-06-09

目标:

- 修复后台打开 AI 助手与 Provider 面板时仍可能出现的 `deadlock detected`
- 修复 GRSAI 站点在后台按 `OpenAI 兼容` 填写时无法验证和拉取模型的问题
- 补齐前后台 AI 助手的图片输入与传输
- 增强后台 `AI 协助配置` 对 API 站点的草案生成和表单承接

## 代码变更摘要

- `apps/api/src/server.ts`
  - PostgreSQL 模式下 `readAdminDb()` 不再在普通读取时执行整库回写
  - Provider 探测/拉模状态改为单 Provider 定点更新
  - 新增 `isGrsaiProviderDraft()`，GRSAI 按协议或站点特征双识别
  - 媒体附件摘要保留安全 URL，便于 Hermes 或 fallback 助手接收真实图片上下文
- `apps/admin/src/admin-api-settings-panel.tsx`
  - Base URL/名称命中 `grsai` 时自动切协议
  - AI 协助配置新增 `接入判断` 展示协议、推荐层级和 async 判断
- `apps/admin/src/admin-assistant-panel.tsx`
  - 后台助手支持图片上传
- `apps/web/src/components/CanvasAssistant.tsx`
  - 画布助手支持图片上传

## 本机验证

- `npm run verify:admin-api-layout-contract`
- `npm run verify:admin-assistant-chat`
- `npm run verify:canvas-assistant-chat`
- `npm run verify:canvas-assistant-ui-contract`
- `npm run verify:admin-assistant-ui-contract`
- `npm run type-check`
- `npm run build:single-port`

## 服务器验收重点

- 灰度 release 切换后，后台首次打开不再因并发读触发 `deadlock detected`
- GRSAI Provider 即使协议下拉框未切到 `GRSAI Draw`，只要站点为 `grsai.dakka.com.cn` 也能返回手动模型目录
- 后台 `AI 协助配置` 可展示并应用草案，但仍需管理员点击保存
- 前后台 AI 助手都可以把上传图片转成 `/files/output/...` 附件并发给对话接口

## 灰度最终结果

- 当前灰度 release: `/opt/apps/xinghuan-canvas-next/releases/20260609-deadlock-grsai-assistant-image-gray-r5`
- `systemctl is-active xinghuan-canvas-next.service` => `active`
- `systemctl is-active xinghuan-canvas-next-worker.service` => `active`
- `curl http://127.0.0.1:18200/api/status` => `environment=gray`
- 服务器真实 smoke:
  - `admin_login pass`
  - `parallel_admin_reads pass`
  - `grsai_probe pass`
  - `grsai_fetch_models pass`
  - `assistant_analyze_provider_protocol grsai_draw`
  - `assistant_analyze_provider_mode hermes`
  - `assistant_analyze_provider pass`
  - `assistant_image_upload pass`
  - `assistant_chat_with_image pass`
- `journalctl -u xinghuan-canvas-next.service` 未出现新的 `deadlock detected`
