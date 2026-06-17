# 核心 API 导航页

这份文档不是完整 OpenAPI，也不是逐字段接口参考。

它的目标更务实：

- 让 AI 和协作者快速知道“这个需求或故障大概落在哪组接口”
- 快速知道“主要实现入口在什么文件”
- 快速知道“第一跳应该怎么排查”

当前权威实现入口仍然是：

- `apps/api/src/server.ts`

高频辅助模块包括：

- `apps/api/src/external-proxy.ts`
- `apps/api/src/provider-generation-task-service.ts`
- `apps/api/src/material-access-service.ts`
- `apps/api/src/task-cancellation-service.ts`

## 1. 健康检查与状态

### 典型路径

- `GET /health`
- `GET /api/health`
- `GET /api/status`
- `GET /api/version`

### 用途

- 判断 API 进程是否可用
- 判断当前环境和版本
- 发布后做最小运行态 smoke

### 鉴权

- 默认不需要登录

### 实现入口

- `apps/api/src/server.ts`

### 排障第一跳

- 先看：
  - `curl http://127.0.0.1:18200/api/status`
  - 或 `curl http://127.0.0.1:18100/api/status`
- 如果本机状态正常、域名不正常，再看 Nginx 和 Cloudflare

## 2. 认证与会话

### 典型路径

- `GET /api/auth/me`
- `GET /api/auth/admin-me`
- `POST /api/auth/login`
- `POST /api/auth/admin-login`
- `POST /api/auth/logout`
- `GET /api/admin/sessions`

### 用途

- 前台/后台登录
- 当前登录态读取
- 会话撤销与会话治理

### 鉴权

- `login` / `admin-login` 本身不需要已有会话
- `me` / `admin-me` / `admin/sessions` 需要有效会话
- 后台会话读取需要管理员权限

### 实现入口

- `apps/api/src/server.ts`
- 会话与 Cookie 工具：
  - `apps/api/src/http-session-utils.js`

### 排障第一跳

- 是否命中了 CSRF 同源限制
- 是否是脚本漏了 `Origin / Referer`
- 是否是会话已撤销
- 是否是 file-mode 并行脚本踩了本地会话

## 3. 助手与聊天

### 典型路径

- `POST /api/assistant/chat`
- `POST /api/assistant/chat/stream`
- `GET /api/assistant/settings`
- `POST /api/admin/assistant/chat`
- `POST /api/admin/assistant/chat/stream`
- `POST /api/admin/assistant/analyze-provider`
- `GET/PATCH /api/admin/assistant/settings`

### 用途

- 画布侧助手对话
- 后台侧助手配置、聊天和 Provider 分析

### 鉴权

- 前台助手需要已登录用户
- 后台助手相关接口需要管理员权限

### 实现入口

- `apps/api/src/server.ts`

### 排障第一跳

- 先分清是前台助手还是后台助手
- 再看失败点是：
  - 登录态
  - 上游模型配置
  - 流式返回
  - 旧断言 / 验收脚本

## 4. 文件与素材

### 典型路径

- `POST /api/files/upload`
- `POST /api/files/upload-base64`
- `GET /api/files/list`
- `POST /api/files/save-to-disk`
- `POST /api/files/duck-decode`
- `GET /api/provider-files/*`
- `/files/*`
- `/input/*`
- `/output/*`

### 用途

- 基础上传
- base64 上传
- Provider 参考文件短链访问
- 输入/输出素材访问

### 鉴权

- 内部上传接口通常需要登录
- `provider-files` 走签名 URL 与时效控制

### 实现入口

- `apps/api/src/server.ts`
- Provider 文件访问：
  - `apps/api/src/provider-file-access.js`

### 排障第一跳

- 是上传失败，还是上传成功后访问失败
- 是本地 `/files/*` 链路，还是签名后的 `/api/provider-files/*`
- 当前公网源是否配置为 `files.hhh2121.xyz`

## 5. 资源库与生成库

### 典型路径

- `GET/POST/PUT/DELETE /api/resources/categories`
- `GET/POST/PUT/DELETE /api/resources/items`
- `POST /api/resources/items/add`
- `GET /api/generation-library/items`
- `GET /api/materials/generation-library/:id/content`

### 用途

- 资源库分类与素材管理
- 生成库列表、预览、下载、内容路由

### 鉴权

- 需要用户登录
- 受 owner / revision 约束

### 实现入口

- `apps/api/src/server.ts`
- 生成库素材访问层：
  - `apps/api/src/material-access-service.ts`

### 排障第一跳

- 先分清是资源库问题还是生成库问题
- 是否是 revision conflict
- 是否是内容路由返回 disposition 异常
- 是否是前端拼 URL，而不是走访问层

## 6. 画布与项目

### 典型路径

- `GET/POST /api/canvas`
- `GET/PUT/DELETE /api/canvas/:id`
- `POST /api/canvas/:id/auto-save`
- `GET/POST /api/projects/*`

### 用途

- 画布创建、读取、保存、删除
- auto-save
- revision 冲突保护

### 鉴权

- 需要登录
- 受 owner 校验

### 实现入口

- `apps/api/src/server.ts`

### 排障第一跳

- 是否是 ownership mismatch
- 是否是 stale revision
- 是 file-mode 还是 postgres
- auto-save 是否把 revision 写回错了

## 7. 外部生成代理

### 典型路径

- `POST /api/proxy/external/image`
- `POST /api/proxy/external/image/task`
- `POST /api/proxy/external/llm`
- `POST /api/proxy/external/video`
- `POST /api/proxy/external/video/task`
- `POST /api/proxy/external/audio`
- `POST /api/proxy/external/audio/task`
- `POST /api/proxy/generation/cancel`

### 用途

- 同步生成
- 异步任务提交
- 任务取消

### 鉴权

- 需要登录
- 依赖后台 Provider / 模型目录

### 实现入口

- 路由总入口：
  - `apps/api/src/server.ts`
- 外部代理处理：
  - `apps/api/src/external-proxy.ts`
- 任务化生成服务：
  - `apps/api/src/provider-generation-task-service.ts`
- 任务取消：
  - `apps/api/src/task-cancellation-service.ts`

### 排障第一跳

- 先分清：
  - 同步接口失败
  - 任务提交失败
  - 任务轮询失败
  - 最终素材落库失败
- 再分清是：
  - Provider 协议不兼容
  - 上游返回 HTML / 非 JSON
  - 模型目录/高级配置不对
  - Worker 消费没跑起来

## 8. 后台治理

### 典型路径

- `GET /api/admin/summary`
- `GET/POST/PATCH/DELETE /api/admin/users`
- `GET/POST/PATCH/DELETE /api/admin/providers`
- `POST /api/admin/providers/probe`
- `POST /api/admin/providers/fetch-models`
- `GET/POST/PATCH/DELETE /api/admin/models`
- `GET /api/admin/tasks`
- `GET/PATCH /api/admin/system`
- `GET /api/admin/audit`

### 用途

- 用户、Provider、模型、任务、系统观测、审计管理

### 鉴权

- 必须管理员会话

### 实现入口

- `apps/api/src/server.ts`

### 排障第一跳

- 先确认是不是管理员会话
- 是分页/筛选问题，还是数据本身没写进去
- `system` 问题优先结合：
  - `verify:release-preflight`
  - `verify:request-chain-observability`
  - `verify:system-observability`

## 9. 如何新增或修改接口

建议顺序：

1. 先确定接口属于哪个域
2. 再确认是否已有相近接口
3. 再判断：
   - 是否需要登录
   - 是否需要管理员权限
   - 是否需要 owner / revision 校验
   - 是否需要审计
4. 如果会写业务对象，默认考虑：
   - 测试数据回收
   - 脚本自清理

## 10. AI 使用建议

当 AI 需要快速理解接口时，建议先看：

1. 本文
2. `docs/project-atlas/interfaces-and-dataflow.md`
3. `apps/api/src/server.ts`
4. 对应辅助模块

不要一上来全文扫描 `server.ts` 再自己猜分组；先按本文的接口域定位，再深入代码。
