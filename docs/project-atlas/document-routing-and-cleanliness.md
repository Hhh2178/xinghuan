# 文档路由与仓库清洁规则

> 兼容说明：本页继续保留为旧正文，新的主入口优先看 `docs/governance/README.md`、`docs/governance/archive-policy.md`、`docs/logbooks/README.md`。

## 主入口只保留什么

- `README.md`
  - 当前工作根和高层状态
- `AGENTS.md`
  - 路由、规则、更新义务
- `MEMORY.md`
  - 当前长期状态、长期决策、长期风险
- `ops/README.md`
  - 当前运行态 / 当前放行入口 / 历史归档索引
- `docs/project-atlas/README.md`
  - AI 与协作者的总纲入口

## 什么不该再让主入口承担

- 大段逐日排障经过
- 旧 release 的完整细节
- 运行产物目录说明全文
- 某次单独热补丁的命令流水

这些内容应分别回到：

- `DEVLOG.md`
- `ops/*.md`
- `docs/runtime-artifacts.md`

## 仓库干净的判断标准

- `git status --short` 没有意外 tracked 改动
- 没有不该提交的运行产物或本机缓存
- 当前 release / 当前阶段 / 当前入口在主入口文件中一致
- 可写型验证脚本不会在运行后留下后台脏数据

## 容易把仓库弄脏的来源

- `dist-release/`、`output/`、`logs/`
- `.tmp/`、`.codex-temp/`、`.codegraph/`
- 临时快照、局部导出的 JSON、手工备份副本
- 只更新 `DEVLOG.md`，不更新主入口

## 防脏动作

### 发布前

- 先看 `git status --short`
- 确认本次变更是否包含误入的临时文件
- 确认 `README.md` / `MEMORY.md` / `ops/README.md` 是否仍是旧 release

### 发布后

- 确认 active release 已同步回主入口
- 确认验收脚本未留下测试 Provider / 测试任务
- 确认新增 runbook 或归档批次已进索引

### 周期性

- 检查 `development/_archive/` 是否持续膨胀但无索引
- 检查 `ops/archive/` 新批次是否补了 `README`
- 检查是否有新的“只有作者自己知道怎么读”的长文档

## 与正式治理规范的关系

本文件强调“保持仓库干净”的执行口径。

正式文档更新和归档触发条件，仍以：

- `docs/documentation-governance.md`

为准。
