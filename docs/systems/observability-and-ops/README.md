# Observability 与 Ops 系统

## 这个系统负责什么

Observability 与 Ops 系统负责 release gate、请求链路观测、系统观测页、gray / production 运维和回滚样本。

## 建议阅读顺序

1. `release-gates.md`
2. `gray-and-production-operations.md`
3. `channel-health.md`
4. `../admin/frontend-design/system-health-visualization-standard.md`

## 系统健康数据边界

- `/api/admin/system` 的 Worker runtime、queue 和容量只能读取当前 environment namespace 与 exact queue。
- 任务趋势使用有界的服务端聚合桶；failed 与 cancelled 分开，样本不足或数据源不可用显示 `unknown`，不得伪装成 0/healthy。
- 页面范围固定为 `1h / 24h / 7d / 30d`；页面不可见暂停轮询，快速切换范围取消旧请求。
- Provider 历史探测与磁盘容量尚未接入时明确显示 unavailable/unknown，不生成假数据。
- Provider / model 渠道健康度的聚合口径、反馈窗口和排障入口见 `channel-health.md`。

## 相关系统

- `../api/`
- `../worker/`
- `../../ops/README.md`

## 兼容正文来源

- `docs/project-atlas/debugging-playbook.md`
- `docs/project-atlas/server-maintenance-and-healthchecks.md`

## 更新规则

- 新的观测与运维正文优先写当前系统目录
- atlas 文件只保留兼容层排障与维护正文
