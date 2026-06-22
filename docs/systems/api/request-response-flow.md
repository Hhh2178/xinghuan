# API 请求与响应链路

## RunningHub 分析链路

1. 后台提交 `requestExample / responseExample`
2. API 解析样例并推断字段、输出和执行规则草案
3. 后台将草案应用为条目结构

## 任务提交链路

1. 前端或后台发起请求
2. API 做鉴权、参数校验和条目解析
3. API 写入本地任务
4. Worker 消费并调用外部平台
5. 查询结果后回写任务状态

## 系统并发链路

1. 后台保存并发配置
2. API 返回最新系统设置
3. Worker 周期刷新并发槽位
4. `/api/admin/system` 聚合“配置值”和“实际生效值”
