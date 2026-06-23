# 归档政策

## 归档原则

- 不直接删除历史证据
- 优先做“主入口瘦身 + 新入口跳转”
- 仍直接用于值守、放行、回滚的材料不要归档
- 具体执行规则以 `documentation-governance-standard.md` 为准

## 需要归档的典型内容

- 已被新 release 覆盖的旧发布材料
- 只具历史审计价值、但不再是当前入口的记录
- 已沉淀到 `docs/systems/` 或 `docs/memory/` 的重复长文

## Phase 1 的做法

- 保留 `README.md`、`AGENTS.md`、`MEMORY.md`、`DEVLOG.md`、`ops/README.md`
- 这些文件转型为“摘要 + 跳转入口”
- 旧正文逐步迁到 `docs/memory/`、`docs/logbooks/`、`ops/archive/`

## 新增文档的落点规则

- 系统现在怎么工作：`docs/systems/`
- 规则和协作方式：`docs/governance/`
- 跨会话长期有效的判断：`docs/memory/`
- 某天做了什么：`docs/logbooks/daily/`
- 某次发布/验证/事故：`docs/logbooks/releases/`、`docs/logbooks/validations/`、`docs/logbooks/incidents/`
- 某项功能是如何演进到现在的：`docs/records/`
