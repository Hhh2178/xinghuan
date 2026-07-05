# AGENTS.md - 无限画布 2.0 项目协作规则

## 项目定位

无限画布 2.0 是公司内部节点式 AIGC 创作平台的新立项项目。旧 `node-banana-enterprise` 项目不再作为产品主干，只作为失败经验、需求来源和迁移参考。

本项目目标是从一开始建立可扩展节点系统、独立后台、模型与服务商管理、云端项目存储、用户隔离、素材空间和任务执行链路，避免在节点基础薄弱的项目上继续补丁式改造。

## 项目总纲入口

默认阅读顺序：`AGENTS.md` -> `docs/INDEX.md` -> `docs/systems/README.md` -> `README.md` -> `MEMORY.md` -> `ops/README.md` -> `DEVLOG.md`

## 系统地图

当任务涉及具体系统时，优先进入：

- RunningHub：`docs/systems/runninghub/`
- 后台 Admin：`docs/systems/admin/`
- API：`docs/systems/api/`
- Worker：`docs/systems/worker/`

## 协作方式

- 先通过 `docs/INDEX.md` 判断要找的是治理规则、系统知识、长期记忆、台账证据，还是历史方案。
- 先读系统知识再读代码，避免直接在 `MEMORY.md`、`DEVLOG.md`、`ops/README.md` 里全文乱找。
- 做完真实改动后，同步检查主入口与对应系统文档，而不是只补一条日志。
- 发现热点文件继续膨胀时，先判断应该新增模块还是新增 hook / helper，而不是默认继续往原文件堆。

## 文件治理与归档规则

- 治理规则、热点拆分与风险评分看 `docs/governance/`
- 系统知识看 `docs/systems/`
- 长期记忆看 `docs/memory/`
- 日常台账、发布证据与验证记录看 `docs/logbooks/`
- 设计与演进记录看 `docs/records/`
- 发布记录正文与 gray/prod 批次证据统一写入 `docs/logbooks/releases/`，不要再散落到临时目录或仅保存在 `ops/` 草稿里。

旧入口文件目前继续保留，但职责已经改成“摘要 + 跳转入口”：

- `README.md`
- `MEMORY.md`
- `DEVLOG.md`
- `ops/README.md`

## 当前目录约定

- `docs/INDEX.md`、`docs/governance/`、`docs/systems/`、`docs/memory/`、`docs/logbooks/`、`docs/records/` 是主文档入口。
- `README.md`、`MEMORY.md`、`docs/prd/README.md`、`ops/README.md` 只保留当前状态摘要和跳转。
- `docs/project-atlas/README.md`、`docs/documentation-governance.md` 只作兼容入口，不再作为第一跳。
- `docs/repo-structure.md`、`docs/runtime-artifacts.md`、`docs/size-audit-2026-06-15.md` 只负责结构、运行产物和体积边界说明。
- `ops/`、`config/`、`development/`、`research/` 分别保留运维、模板、过程资料和调研材料。

## 默认查看顺序

当需要快速恢复上下文时，优先顺序仍按上面的默认阅读顺序；若要补结构信息，再看 `docs/repo-structure.md` 和 `docs/runtime-artifacts.md`。

## 入口优先级

当前无限画布 2.0 的默认工作入口就是本目录：

- `D:/codex/无限画布2.0-worktrees/xinghuan-integration-clean`

使用原则：

- 当前开发、部署、验收和结构整理，优先看本目录下的 `AGENTS.md`、`README.md`、`MEMORY.md`、`DEVLOG.md`、`docs/`、`ops/`
- 当前默认导航先走 `docs/INDEX.md -> docs/systems/<system>/ -> 代码`
- 当前状态先看 `README.md`、`MEMORY.md`、`docs/prd/README.md`、`ops/README.md`，不要只看旧日志顶部或历史灰度记录判断状态
- `D:/codex/无限画布2.0` 是主仓库，不是当前默认工作现场
- `D:/codex/服务器/无限画布/` 只作为旧主干/旧文档参考入口，不作为当前 2.0 的主说明来源
- `output/`、`releases/`、`dist-release/`、`logs/` 等目录不作为需求和设计入口，说明统一看 `docs/runtime-artifacts.md`
- 根目录 `releases/` 属于运行产物忽略目录；`docs/logbooks/releases/` 属于文档证据目录，必须可提交、可索引、可追踪，不能与运行产物目录混淆。

## 安全规则

- 禁止批量删除文件或目录。
- 不要使用 `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 需要删除文件时，只能一次删除一个明确路径的文件。
- 不要把 API Key、Token、Cookie、SSH Key、数据库密码写入文档、Git、日志、截图或聊天输出。
- 真实服务商 Key 只能放入服务器环境变量、密钥管理系统或后台加密字段。
- 设计和代码尽量使用相对路径，避免绑定单机绝对路径。

## CodeGraph 规则

- 当前仓库默认启用 CodeGraph 工作流，优先用它理解结构、依赖关系和影响面。
- 开始看代码前先执行：
  - 已有索引时：`codegraph status`
  - 尚未建索引时：`codegraph init -i`
- 涉及以下场景时，优先使用 CodeGraph，再回退到 `rg` 或手工阅读：
  - 找符号定义、调用链、依赖方、影响面
  - 判断改动会波及哪些模块
  - 恢复仓库上下文
- 完成代码修改后、交付前，执行一次 `codegraph sync`，保持索引与源码一致。
- 当前仓库的 Git hook 约定：
  - `post-checkout`、`post-merge`、`post-rewrite`：若缺少索引则执行 `codegraph init -i`，否则执行 `codegraph sync`
  - `post-commit`：执行 `codegraph sync`，保持索引与提交后的源码一致。

## 工程治理与发布护栏

- 热点文件预算与 watchlist 必须保持可执行：
  - `npm run verify:file-hotspot-budgets`
  - `npm run verify:hotspot-watchlist-contract`
  - `npm run verify:hotspot-doc-sync-staged`
- `1200+` 行文件默认进入热点关注范围；继续触碰热点文件时，必须留下对应台账、计划或发布记录，说明下一步拆分路线。
- 当前热点风险评分入口：
  - `docs/governance/hotspot-risk-scorecard.md`
- release logbook 与当前运行态入口必须同步：
  - `npm run verify:release-logbook-sync-staged`
  - `npm run verify:current-release-entry-consistency`
  - `ops/current/gray.md`
- 发布前必须确认工作树与运行产物边界：
  - `npm run verify:no-runtime-artifacts-staged`
  - `npm run verify:staged-source-size-guard`
  - `npm run verify:release-worktree-clean`
- `.githooks/pre-commit` 会执行提交前治理检查；不要通过跳过 hook 的方式绕过热点、release logbook 或运行产物护栏。