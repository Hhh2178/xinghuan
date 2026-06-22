# RunningHub 集成架构

## 总体链路

1. 管理员在后台维护 RH catalog 条目
2. 条目经 API 透出给画布节点
3. 画布节点选择条目并组装运行参数
4. API 将任务写入本地任务系统
5. Worker 根据条目 `kind` 与执行描述调用 RH 官方接口
6. 查询结果后回写任务结果，再由前端读取输出

## 四层职责

### 后台 Admin

- 负责条目新建、启停、测试、分析与字段维护

### API

- 负责 catalog 规范化
- 负责把条目转换成可执行描述
- 负责保护 `workflow/app` 归属与字段约束

### Web 节点

- 负责显示条目、参数区、输出摘要和运行态

### Worker

- 负责真正调用 RH Workflow 或 AI App 提交/查询协议

## 当前实现重点

- Workflow 与 AI App 的协议分支已经分开
- worker 已切到 AI App v2 的提交/查询协议
- 节点提交流程会显式带 `pageId / workflowId / runTargetId / targetType / taskCapability`
