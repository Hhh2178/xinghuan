# 核心接口与数据流

## 主要接口分组

### 认证与会话

- `/api/auth/login`
- `/api/auth/admin-login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/admin/sessions`

用途：

- 前台/后台登录
- 当前会话识别
- 会话撤销与治理

### 画布与项目

- `/api/canvas/*`
- `/api/projects/*`

用途：

- 画布读取、保存、auto-save、revision 冲突保护

### 资源与素材

- `/api/resources/*`
- `/api/materials/generation-library/*`
- `/files/*`

用途：

- 资源库、生成库、输入输出素材访问
- 当前生成库内容访问统一走素材访问层，不再让前端各自拼 URL

### 后台治理

- `/api/admin/providers/*`
- `/api/admin/models/*`
- `/api/admin/tasks`
- `/api/admin/system`
- `/api/admin/users/*`

用途：

- Provider / 模型发布
- 任务分页、筛选、取消、状态观察
- 系统观测与 release gate

### 生成代理

- `/api/proxy/external/image`
- `/api/proxy/external/image/task`
- `/api/proxy/external/video`
- `/api/proxy/external/video/task`
- `/api/proxy/external/chat`

用途：

- 同步与异步生成代理
- 通用节点面向后台目录消费，不面向单 Provider 硬编码

## 关键数据流

### 图像 / 视频生成

1. 前端提交生成请求
2. API 读取用户会话、模型目录、Provider 配置
3. API 直接同步执行，或写入任务表并送入 Redis
4. Worker 消费任务、调用上游、轮询结果
5. 输出素材写入 `/files/output/...`
6. 结果回写任务表与生成库

### 后台观测

1. 后台读取 `/api/admin/system`
2. API 汇总数据库、任务、审计、conflict 统计
3. 页面展示 health / trend / coverage 状态

### 生成库访问

1. 列表接口返回 `previewUrl` / `downloadUrl` / `openUrl`
2. 前端预览/下载统一通过内容路由访问
3. 素材访问层负责 disposition 和文件名语义

## 当前高频风险点

- CSRF 之后，所有本地脚本写请求必须带 same-origin `Origin`
- file-mode 多脚本并行会互相覆盖本地会话和审计样本
- 某些上游失败会返回 HTML 或非 JSON，必须在代理层做明确报错
- 可写型验证脚本如果不自清理，会在线上残留假 Provider 或假数据
