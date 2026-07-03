# 系统知识总览

这里存放“系统现在如何工作”的主题知识包。

## 当前优先维护的系统

- `runninghub/`
- `admin/`
- `api/`
- `worker/`
- `canvas/`
- `providers/`
- `auth-and-users/`
- `storage-and-data/`
- `observability-and-ops/`
- `harness/`

## 推荐阅读顺序

1. 先看对应系统目录下的 `README.md`
2. 再看系统专题文件
3. 最后再回代码文件

## 与其他目录的分工

- `docs/governance/`：规则、流程、归档
- `docs/memory/`：长期判断与部署记忆
- `docs/logbooks/`：逐日证据、发布与验证记录
- `docs/records/`：设计方案与演进历史

## 系统地图

### RunningHub

- 关注：协议接入、catalog 条目、Workflow / App 区分、节点运行态

### Admin

- 关注：后台能力边界、页面组织、配置入口、RunningHub 工作台

### API

- 关注：前后端接口、鉴权、提交链路、查询链路

### Worker

- 关注：消费模型、并发控制、结果落库、输出物料化

### Canvas

- 关注：节点体系、项目读写、素材与生成结果消费

### Providers

- 关注：协议分层、请求体与文件策略、模型级端点分流

### Auth 与 Users

- 关注：会话、CSRF、ownership、revision、多用户治理

### Storage 与 Data

- 关注：PostgreSQL / Redis 分工、输出落库、生成库访问

### Observability 与 Ops

- 关注：release gate、gray/prod 运维、系统观测页

### Harness

- 关注：workspace / verify / release / integration 执行分层、根脚本聚合入口、子 harness 接入约定
