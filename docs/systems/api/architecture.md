# API 架构

## 核心职责

- 鉴权与会话
- 后台管理接口
- 画布节点提交接口
- 任务状态查询
- 系统运行态聚合

## 上下游

- 上游：Admin、Web 画布、验收脚本
- 下游：数据库、Redis、Worker、外部 Provider、RunningHub

## 当前重点分支

- 普通 Provider 任务链路
- RunningHub 任务链路
- 后台系统设置与运行态聚合链路
