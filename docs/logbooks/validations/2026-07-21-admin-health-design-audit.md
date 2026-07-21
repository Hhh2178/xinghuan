# Admin 系统健康与公共资源设计审查

日期：2026-07-21
范围：桌面 Admin；不包含移动端
基准：用户提供的系统健康页截图与 Provider 接入页截图

## 第一印象

原系统健康页存在明显的组件拼盘感：五张同权重卡片、黑底拓扑框、无刻度折线和高饱和容量条同时竞争注意力。它没有继承 Provider 页已经稳定的深蓝层级、青色细描边、紧凑标题、中文业务状态与“一个主工作面”的空间语言。

## Findings

### FINDING-001：健康页层级与图表表达割裂

- 严重度：High
- 修复状态：best-effort
- commit：`48dc34b`
- 文件：`AdminSystemHealthDashboard.tsx`、`styles.css`、`system-health-visualization-standard.md`
- 修复：首屏收敛为一体化运行态势、活动告警和五域摘要；固定服务链路；趋势增加摘要、刻度、网格、时间和单位；容量增加配置上限、安全阈值、实际槽位、深度与 Worker 数；状态文案改为中文。
- 验证：组件契约、Admin type-check/build、全量测试、Gray runtime/readiness、页面路由与服务日志通过。登录态最终视觉截图留给 Gray 管理员验收，因此未把本项标为 fully verified。

### FINDING-002：公共资源与公告混在同一工作域

- 严重度：Medium
- 修复状态：verified
- commit：`daaee45`
- 文件：`admin-view-model.ts`、`admin-data-loaders.ts`、信息架构与契约文档
- 修复：公共资源独立为 `/admin/resources` 一级工作域，公告进入“内容发布”；旧路径保留兼容解析。
- 验证：view model、Starlight shell、公共资源契约通过；新旧三个页面路径均在 Gray 返回本轮 Admin entry。

## 评分

| 指标 | 基线 | 实现后（源码与契约审查） |
| --- | ---: | ---: |
| 设计一致性 | 44 / 100 | 82 / 100 |
| 信息可解释性 | 38 / 100 | 86 / 100 |
| AI / 模板化拼盘感 | 72 / 100（越低越好） | 20 / 100 |

最终视觉分数需要用户在已登录 Gray 页面确认；以上实现后评分仅表示源码、Token、结构和契约审查结果。

## Summary

- Findings：2
- Verified：1
- Best-effort：1
- Reverted：0
- Deferred：0
- PR 摘要：Design review found 2 issues and fixed both; system health now follows the Provider workspace language, and public resources has its own top-level workspace.
