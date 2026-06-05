# 灰度后台安全增强记录 - 2026-06-05

## 目标

- 补齐统一后台的安全底座。
- Provider Key 不再明文落盘。
- 管理员可在后台重置用户密码。
- 后台关键操作进入审计日志。

## Release

- release id：`20260605-1245-xinghuan-admin-sec-gray`
- 服务器 release 目录：`/opt/apps/xinghuan-canvas-next/releases/20260605-1245-xinghuan-admin-sec-gray`
- 当前指针：`/opt/apps/xinghuan-canvas-next/current`

## 变更范围

- `apps/api`：
  - Provider Key 写入时使用 AES-256-GCM 加密。
  - 旧明文 Key 读取时自动迁移为 `enc:v1` 加密格式。
  - Provider API 只返回 `hasApiKey` 和后四位预览。
  - 新增 `/api/admin/audit`。
  - 后台新增、修改用户、Provider、模型和任务时写入审计日志。
- `apps/admin`：
  - 用户管理表增加密码重置输入和操作。
  - Provider 管理表增加 Key 更新和清除操作。
  - 新增审计日志页面。
- `config`：
  - 环境模板新增 `XINGHUAN_SECRET_KEY`。
- 服务器：
  - 灰度环境已生成 `XINGHUAN_SECRET_KEY`，未记录明文。

## 验收证据

- 本机 `npm run type-check -w @xinghuan/api` 通过。
- 本机 `npm run type-check -w @xinghuan/admin` 通过。
- 本机 `npm run build:single-port` 通过。
- 本机 `npm run verify:single-port` 通过：
  - Provider 创建接口只返回脱敏 Key。
  - `/api/admin/audit` 返回审计记录。
- 本机 `apps/api/data/admin/admin.json` 检查：
  - 不包含 `verify-secret-` 明文。
  - 包含 `enc:v1` 加密字段。
  - 包含 `provider.create` 审计记录。
- 服务器 `npm ci` 通过，0 vulnerabilities。
- 服务器 `npm run build:single-port` 通过。
- 服务器 `npm run verify:single-port` 通过。
- 服务器 `admin.json` 检查：
  - 不包含 `verify-secret-` 明文。
  - 包含 `enc:v1` 加密字段。
  - 包含 `provider.create` 审计记录。
- 公网审计页截图：`output/playwright/gray-admin-audit-https.png`。
- 公网审计页 DOM 确认不包含测试 Key 明文。

## 影响

- 后台 Provider Key 已从明文文件存储升级为加密存储。
- 管理员可通过后台重置用户密码。
- 后台关键变更可在审计页追踪。

## 后续

- 正式生产前需要将文件型后台数据迁移到 PostgreSQL。
- `XINGHUAN_SECRET_KEY` 需要纳入正式密钥备份和轮换流程。
- 审计日志后续需要增加 IP、User-Agent 和请求 ID。
- Provider Key 后续可迁移到数据库加密字段或专用 secret store。
