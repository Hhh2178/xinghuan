# PostgreSQL 与 Redis 边界

## 当前分工

- PostgreSQL：用户、画布、资源、任务、后台配置
- Redis：任务队列、worker 运行态、并发执行窗口辅助状态

## 当前重点

- 数据库目标校验必须成立
- 分类队列与 RunningHub 平台窗口不能混成一个总队列心智
