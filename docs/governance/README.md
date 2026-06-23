# 文档治理

这里存放无限画布 2.0 的协作规则、入口顺序、归档政策和仓库导航方法。

## 这一层放什么

- 协作流程
- 文档分类规则
- 阅读顺序
- CodeGraph 与 `rg` 的使用边界
- 归档与清理规则

## 这一层不放什么

- 业务系统的协议细节
- 逐日推进记录
- 单次发布与验收证据

## 推荐阅读顺序

1. `documentation-governance-standard.md`
2. `engineering-guardrails.md`
3. `collaboration-and-workflow.md`
4. `codegraph-and-repo-navigation.md`
5. `archive-policy.md`
6. `templates/README.md`

## 正式规范与兼容关系

- 当前正式规范：`documentation-governance-standard.md`
- 旧规范 `docs/documentation-governance.md` 继续保留，但只作为兼容跳转层
- 新入口以 `docs/INDEX.md` 和本目录为准

## 兼容正文来源

- `docs/documentation-governance.md`
- `docs/project-atlas/document-routing-and-cleanliness.md`
- `docs/project-atlas/logbook-maintenance.md`

## 更新规则

- 新的治理规则、模板和归档政策优先写当前目录
- 旧治理正文与 atlas 文件只保留兼容层内容

## 模板目录

- `templates/daily-log-template.md`
- `templates/release-record-template.md`
- `templates/validation-record-template.md`
- `templates/system-readme-template.md`

## 工程护栏

- 热点大文件预算与发布前工作树清洁规则：`engineering-guardrails.md`
- 对应脚本：
  - `npm run verify:file-hotspot-budgets`
  - `npm run verify:hotspot-watchlist-contract`
  - `npm run verify:hotspot-doc-sync-staged`
  - `npm run verify:release-worktree-clean`
  - `npm run verify:engineering-governance-contract`
