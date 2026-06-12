# 仓库结构与 Worktree 说明

## 为什么当前项目在 `D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b`

当前目录不是“另一个项目副本”，而是 Git worktree。

- 主仓库目录：`D:\codex\无限画布2.0`
- 当前工作树：`D:\codex\无限画布2.0-worktrees\xinghuan-milestone-b`
- 当前分支：`xinghuan-milestone-b`

这样做的目的：

- 让 `main` 主目录保持相对干净，不被当前里程碑上的大量未合并改动打乱
- 允许在同一台机器上同时保留主干和当前阶段开发现场
- 便于后续对比、回滚、整理和提交

当前工作树中的 `.git` 不是完整仓库目录，而是指向主仓库：

- `gitdir: D:/codex/无限画布2.0/.git/worktrees/xinghuan-milestone-b`

因此这里仍然属于同一个 Git 仓库，只是分离出来的独立工作目录。

建议配合以下入口一起理解当前现场：

- `AGENTS.md`
- `MEMORY.md`
- `docs/runtime-artifacts.md`
- `ops/README.md`

## 当前目录角色

- `apps/`
  - 业务应用源码，属于主开发区
- `packages/`
  - 共享包与底层能力
- `scripts/`
  - 验收、迁移、发布和维护脚本
- `config/`
  - 环境变量模板和非密钥配置模板
- `docs/`
  - 长期产品、规范和结构化计划文档
- `ops/`
  - 部署、验收、服务器和运行态记录
- `development/`
  - 开发过程资料、候选方案、阶段说明
- `research/`
  - 外部参考与调研材料
- `DEVLOG.md`
  - 开发推进台账
- `MEMORY.md`
  - 长期记忆与部署状态

## 哪些目录不是正式源码

以下目录主要是本地运行、打包或验收产物，不属于正式源码结构：

- `output/`
- `releases/`
- `dist-release/`
- `logs/`
- `.tmp/`
- `.codex-temp/`
- `.codegraph/`
- `.playwright-cli/`

这些目录已经被 `.gitignore` 排除。它们可以保留用于本机追踪，也可以在确认不再需要后做单独清理，但不应该和正式源码、文档混在一起理解。

更细的运行产物边界见 `docs/runtime-artifacts.md`。

## 当前整理原则

- 不动仍在开发中的源码文件
- 不清理服务器运行数据或真实素材
- 历史运维记录优先归档，不直接删除
- 长期有效的入口说明保留在原位
