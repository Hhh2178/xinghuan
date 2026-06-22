# Admin 架构

## 结构分层

### 后台前端

- 展示管理页
- 负责表单、列表、只读观测与错误提示

### 后台 API

- 负责保存配置、返回只读系统信息、透出 catalog 与任务信息

### 下游系统

- API/Worker
- Provider 配置
- RunningHub catalog
- 环境同步目标环境

## 关键协作关系

- Admin 写入系统设置后，需要 API 和 Worker 真实吃到配置
- Admin 的 RunningHub 条目录入，需要影响前端画布节点与 Worker 执行
- Admin 的“AI 分析并填写”只是辅助建模，不是外部托管服务
