# 无限画布 2.0

公司内部节点式 AIGC 创作平台当前活跃工作目录。

## 当前工作根

当前默认开发入口：

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

这不是另一份独立项目副本，而是主仓库 `D:/codex/无限画布2.0` 挂出的 Git worktree，用于承载当前里程碑的大量未合并改动。

结构说明见：

- `docs/repo-structure.md`
- `docs/runtime-artifacts.md`

## 快速入口

- `AGENTS.md`
  - 当前协作规则、工程边界和默认查看顺序。
- `MEMORY.md`
  - 当前项目长期记忆、部署状态和关键决策。
- `DEVLOG.md`
  - 最近推进、验证、部署与回滚台账。
- `docs/prd/README.md`
  - 当前 2.0 文档索引。
- `ops/README.md`
  - 运维、验收和归档材料入口。
- `development/README.md`
  - 临时方案、开发过程资料和归档规则。

## 当前定位

- 当前活跃版本：`v0.1.0`
- 当前灰度：`canvas-next.hhh2121.xyz`
- 当前生产：`canvas.hhh2121.xyz`
- 当前架构：前后端与 worker 统一在本项目 2.0 worktree 中推进
- 当前生成能力：统一通过外部 API 接入，不在 VPS 跑本地 GPU 推理

## 目录边界

- 正式源码与长期文档：
  - `apps/`
  - `packages/`
  - `scripts/`
  - `config/`
  - `docs/`
  - `ops/`
  - `development/`
- 运行产物与辅助目录：
  - `output/`
  - `releases/`
  - `dist-release/`
  - `logs/`
  - `.tmp/`
  - `.codex-temp/`
  - `.codegraph/`
  - `.playwright-cli/`

运行产物详细边界见 `docs/runtime-artifacts.md`。

## 与旧目录的关系

- `D:/codex/服务器/无限画布/`
  - 现在只作为旧主干 / 历史方案 / 旧部署记录参考
- `D:/codex/无限画布2.0`
  - 当前 worktree 所属主仓库

如果旧目录与本目录文档冲突，以当前 worktree 为准。
