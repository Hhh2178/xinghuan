# 后台数据模型导航页

> 兼容说明：本页继续保留为旧正文，新的主入口优先看 `docs/systems/storage-and-data/README.md`、`docs/systems/storage-and-data/postgres-and-redis-boundaries.md`、`docs/systems/auth-and-users/revision-and-ownership-guard.md`。

这份文档的目标不是逐字段 DDL 手册，而是回答三个问题：

1. 当前主要数据对象分成哪几域
2. 对应表和迁移批次大概落在哪
3. 排查某类数据异常时优先看哪块

当前权威来源：

- `apps/api/db/*.sql`
- `apps/api/src/server.ts`

## 1. 迁移批次总览

当前迁移目录：

- `001_admin_core.sql`
- `002_provider_model_framework.sql`
- `003_canvas_resource_repository.sql`
- `004_provider_model_framework_backfill.sql`
- `005_user_password_cipher.sql`
- `006_assistant_settings.sql`
- `007_model_capability_tags_audio.sql`
- `008_task_queue_settings.sql`
- `009_canvas_revision.sql`
- `010_resource_revision.sql`
- `011_admin_settings_revision.sql`
- `012_session_governance.sql`
- `013_login_rate_limit.sql`
- `014_task_runtime_phase_d.sql`

## 2. 数据域分组

### A. 用户、会话与登录限流

核心对象：

- 用户
- 会话
- 登录失败计数

典型表：

- `xh_users`
- `xh_sessions`
- `xh_login_attempts`

主要迁移：

- `001_admin_core.sql`
- `012_session_governance.sql`
- `013_login_rate_limit.sql`

重点规则：

- 会话支持撤销、活跃态和最近访问时间
- 登录限流按 `scope + email + ip` 维度累计

排障第一跳：

- 登录失败是凭据问题、CSRF 问题，还是被限流
- 会话丢失是用户登出、管理员撤销，还是脚本并发踩会话

### B. Provider、模型与后台设置

核心对象：

- Provider
- 模型目录
- 助手设置
- 系统任务并发设置

典型表：

- `xh_providers`
- `xh_models`
- `xh_assistant_settings`
- `xh_system_settings`

主要迁移：

- `002_provider_model_framework.sql`
- `004_provider_model_framework_backfill.sql`
- `006_assistant_settings.sql`
- `008_task_queue_settings.sql`
- `011_admin_settings_revision.sql`

重点规则：

- Provider Key 需要加密落盘
- 模型目录与参数 schema 分离
- 后台关键设置纳入 revision 冲突保护

排障第一跳：

- 是 Provider 配置本身错，还是模型高级设置不对
- 是 revision 冲突，还是旧页面覆盖了新配置

### C. 画布与项目

核心对象：

- 画布元数据
- 画布内容数据

典型表：

- `xh_canvases`

主要迁移：

- `003_canvas_resource_repository.sql`
- `009_canvas_revision.sql`

重点规则：

- 画布受 owner 保护
- auto-save 不能绕过 revision 规则
- 不允许跨用户通过客户端 id 改归属

排障第一跳：

- `CANVAS_OWNERSHIP_MISMATCH`
- `CANVAS_REVISION_CONFLICT`
- file-mode / postgres 行为差异

### D. 资源库与生成库

核心对象：

- 资源分类
- 资源素材
- 生成库输出素材

典型表：

- `xh_resource_categories`
- `xh_assets`
- 生成库列表本身依赖任务和素材落库结果

主要迁移：

- `003_canvas_resource_repository.sql`
- `010_resource_revision.sql`

重点规则：

- 分类和资源都受 owner 与 revision 约束
- 删除分类时，关联资源需要同步 revision 递增
- 生成库访问不再让前端裸拼文件 URL

排障第一跳：

- `RESOURCE_OWNERSHIP_MISMATCH`
- `RESOURCE_REVISION_CONFLICT`
- 是资源库数据错，还是生成库访问描述错

### E. 任务、队列与运行时

核心对象：

- 任务记录
- 任务状态机
- 任务并发设置

典型表：

- `xh_tasks`
- `xh_system_settings.task_queue_settings`

主要迁移：

- `008_task_queue_settings.sql`
- `014_task_runtime_phase_d.sql`

重点规则：

- 队列按 capability 拆分
- 任务状态受取消、重试、heartbeat、stale reaper 影响
- 后台任务列表已切分页

排障第一跳：

- 任务是否根本没入队
- 是 API 提交失败，还是 Worker 没消费
- 是运行失败，还是输出素材没落库

### F. 审计与观测

核心对象：

- 审计日志
- requestId 覆盖率
- revision conflict 观测

典型表：

- `xh_audit_logs`

主要迁移：

- admin core 基础结构
- 后续观测字段主要通过代码演进补充使用

重点规则：

- requestId、ip、userAgent 要能进审计
- conflict 要能落为审计事件

排障第一跳：

- 是真实业务故障，还是审计脚本补样问题
- 是覆盖率低，还是读取链没纳入样本

## 3. file-mode 与 postgres 双态边界

当前代码仍兼容：

- `file`
- `postgres`

但正式判断和运行态以 `postgres` 为准。

需要特别注意：

- file-mode 更容易被多脚本并行踩状态
- 某些迁移、owner、revision 保护只有在 postgres 侧才是正式结论

## 4. 数据模型变更时必须同步哪些文档

如果新增表、迁移批次、关键 revision 规则或后台设置结构，至少同步：

- 本文
- `docs/project-atlas/api-navigation.md`（如果接口边界变化）
- `docs/project-atlas/worker-execution-chain.md`（如果任务执行链变化）
- `MEMORY.md`（如果影响长期运行态判断）
- `ops/*.md`（如果影响 gray / prod gate）
