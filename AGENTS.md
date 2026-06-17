# AGENTS.md - 无限画布 2.0 项目协作规则

## 项目定位

无限画布 2.0 是公司内部节点式 AIGC 创作平台的新立项项目。旧 `node-banana-enterprise` 项目不再作为产品主干，只作为失败经验、需求来源和迁移参考。

本项目目标是从一开始建立可扩展节点系统、独立后台、模型与服务商管理、云端项目存储、用户隔离、素材空间和任务执行链路，避免在节点基础薄弱的项目上继续补丁式改造。

## 当前目录约定

- `AGENTS.md`：本文件，记录协作和工程规则。
- `MEMORY.md`：长期项目记忆、关键决策、服务器和部署状态。
- `DEVLOG.md`：开发日志台账，按日期记录真实推进、测试和部署。
- `README.md`：当前工作根入口和高层状态摘要。
- `docs/project-atlas/README.md`：AI 与协作者的总纲入口，统一索引结构、环境、接口、排障和台账规则。
- `docs/repo-structure.md`：当前 worktree、主仓库、过程目录和运行产物目录说明。
- `docs/runtime-artifacts.md`：运行产物目录和清理边界说明。
- `docs/documentation-governance.md`：文档路由、更新触发条件和归档规范。
- `docs/size-audit-2026-06-15.md`：当前仓库体积基线、主要占用来源和后续瘦身顺序。
- `docs/prd/README.md`：PRD 版本索引。
- `docs/prd/v0.1.0/`：当前 2.0 初始规划版本文档。
- `ops/`：服务器、部署、运维和验收记录。
- `config/`：非密钥配置模板。
- `development/`：开发过程资料和临时实施记录。
- `research/`：候选项目、节点库、参考项目调研。

## 默认查看顺序

当需要快速恢复上下文时，优先顺序：

1. `AGENTS.md`
2. `README.md`
3. `docs/project-atlas/README.md`
4. `MEMORY.md`
5. `docs/documentation-governance.md`
6. `docs/repo-structure.md`
7. `docs/runtime-artifacts.md`
8. `docs/prd/README.md`
9. `ops/README.md`
10. `DEVLOG.md`

## 入口优先级

当前无限画布 2.0 的默认工作入口就是本目录：

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

使用原则：

- 当前开发、部署、验收、结构整理，优先看本目录下的 `AGENTS.md`、`docs/project-atlas/README.md`、`MEMORY.md`、`DEVLOG.md`、`docs/`、`ops/`
- 当前状态先看 `README.md`、`MEMORY.md`、`docs/prd/README.md`、`ops/README.md`，不要只看旧日志顶部或历史灰度记录判断状态
- `D:/codex/无限画布2.0` 是主仓库，不是当前默认工作现场
- `D:/codex/服务器/无限画布/` 只作为旧主干/旧文档参考入口，不作为当前 2.0 的主说明来源
- `output/`、`releases/`、`dist-release/`、`logs/` 等目录不作为需求和设计入口，说明统一看 `docs/runtime-artifacts.md`

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
  - `post-commit`：执行 `codegraph sync`
- Hook 文件放在仓库根的 `.githooks/`，通过 `core.hooksPath` 指向，避免直接依赖主仓库 common-dir 的默认 hooks 目录。
- 由于 Git 不会仅凭版本化文件自动安装 `core.hooksPath`，首次 clone 或新建 worktree 后必须执行一次：
  - `npm run setup:codegraph-hooks`
  - 或 `node scripts/setup-codegraph-hooks.mjs`
- `.codegraph/` 只作为本机分析缓存，不提交到 Git，不作为正式文档或源码目录。

## 工程规则

- 新项目开始前必须先完成基底选型评审，不允许直接在旧 Node Banana 主干继续开发。
- 任何候选开源项目必须先检查许可证、节点体系、执行引擎、前后端结构、可扩展性、维护状态和商用风险。
- 节点系统必须优先设计为插件化或注册表驱动，避免新增节点需要改多个核心文件。
- 生成节点不得按“一个服务商一个节点”设计；应采用通用节点 + 后台模型目录 + 参数 schema + 输入 profile。
- 图片、视频、音频、文本、mask、bbox、json、数组、项目素材等数据类型必须显式隔离，不能用 `any` 绕过连接校验。
- 后台必须是独立 Web 页面，不挂在画布右侧抽屉里。
- 项目保存必须默认走云端服务器，不再以本地文件夹作为主存储。
- 每一轮真实开发都要更新 `DEVLOG.md` 和当前版本 `progress.md` / `changelog.md`。

## 版本治理规则

- 当前活跃版本已推进为 `v0.3.1`。
- 后续每一次 gray / production 真实发布，都必须推进一个非 major 版本号，不能继续长期复用同一个小版本。
- `major` 版本升级只能在用户明确下达升级指令后执行，协作过程中不得自行推进大版本。
- 同一批 release 的 gray 与 production 必须暴露相同的应用版本号，不能出现“同批发布但两个环境显示不同版本”的状态。
- 当 gray 的一批改动被确认同步到 production 时，gray 端显示的版本号也必须与 production 保持一致。

## 文档与归档规则

- 文档主路由和更新规范以 `docs/documentation-governance.md` 为准。
- AI 与协作者的结构化总纲入口以 `docs/project-atlas/README.md` 为准。
- 结构、环境、接口、排障路径和台账规范，优先收口到 `docs/project-atlas/`，不要继续零散只写进 `MEMORY.md` 或一次性方案文档。
- 当前状态只允许在少数主入口中维护：
  - `README.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `ops/README.md`
- 如果阶段、release、放行结论发生变化，必须在同一轮推进内同步更新这些主入口，不能只写进 `DEVLOG.md`。
- `DEVLOG.md` 负责逐日推进，不承担唯一状态入口职责。
- `DEVLOG.md` 的模板与三层台账维护规则见 `docs/project-atlas/logbook-maintenance.md`。
- `ops/` 根目录只保留当前运行态、当前放行和当前值守仍需要的材料。
- 已完成且被后续阶段覆盖的灰度/正式记录，应移动到 `ops/archive/`，不要长期挂在 `ops/README.md` 的当前入口中。
- `development/` 只保留仍在参考或后续可能继续推进的方案；失活过程文档应移到 `development/_archive/`。
- 禁止在多个入口文件中长期保留互相冲突的阶段表述。
- 运行产物、归档包或本机缓存体积明显增长时，应同步检查 `docs/runtime-artifacts.md` 与 `docs/size-audit-2026-06-15.md` 是否仍反映当前现实。
- 如果仓库结构、运行环境、接口边界或排障路径发生变化，必须同步更新 `docs/project-atlas/` 对应手册。
- `ops/README.md` 的“当前运行态 / 当前放行入口”只保留当前 active release 仍直接依赖的材料；出现新阶段或新 release 后，旧记录必须在同轮推进内判断是否归档。
- 只要新增 `ops/archive/` 归档批次，就必须同步更新 `ops/archive/README.md` 与相关批次 `README.md`，否则本轮文档收尾不算完成。
- 每轮真实推进收尾前，至少交叉核对一次：
  - `README.md`
  - `AGENTS.md`
  - `MEMORY.md`
  - `docs/prd/README.md`
  - `ops/README.md`

## 视觉与产品规则

- 主视觉采用科技黑、黑绿/青绿色强调色，面向公司内部生产工具，不做营销落地页。
- 首页默认进入可用工作台或登录页，不做空泛介绍页。
- 画布 UI 字号默认以旧项目为基准放大约 `1.5x`，并支持用户在设置里调整。
- 上传和输出的图片/视频节点必须持续保持素材宽高比，上传后和手动缩放时都不能被任意拉伸变形。
- 管理后台采用仪表盘和表格结合的可视化设计，提供 Provider、模型、任务、日志、素材、用户、项目和配额管理。

## 当前状态

- 2.0 当前活跃版本已为 `v0.3.1`。
- 产品路线口径：
  - `Phase 2` 节点与模型治理已完成灰度验收。
  - `Phase 3` 任务与素材闭环已完成主要能力落地，并继续以当前版本文档为主记录。
- 多用户正式化治理口径：
  - `Phase A` 已完成 owner/仓储止血第一批收口。
  - `Phase B` 已完成 revision 冲突保护。
  - `Phase C` 已完成会话治理、CSRF、登录限流，并已发布到灰度与生产。
  - `Phase D` 已完成当前代码收口、本地验收、灰度发布与正式发布。
  - `Phase E` 已完成 gray / production 放行：
    - 第一阶段请求链路观测
    - 第二阶段系统观测页与放行 gate
    - 长期观测治理第一批：失败窗口与 revision conflict 统计
    - 长期观测治理第二批：健康判断、趋势对比与阈值状态
  - 当前已补齐 gray / production rollback 样本。
  - 当前长期观测治理下一步：
    - requestId 覆盖率持续提升
    - 告警触发与通知闭环
    - 更长时间窗口的运行稳定性基线
- 旧项目已被明确放弃作为继续开发主干。
- 当前服务器实态：
  - 灰度 `canvas-next.hhh2121.xyz` / `127.0.0.1:18200`
  - 生产 `canvas.hhh2121.xyz` / `127.0.0.1:18100`
  - 当前灰度 release：`20260617-environment-sync-layout-v031-gray-r1-dfd5f37`
  - 当前生产 release：`20260617-environment-sync-layout-v031-prod-r1-dfd5f37`
  - `2026-06-17` 已完成柏拉图视频 Provider 接入热修复：
    - `grok-1.5-video-6s/10s/15s` 走 `/v1/videos` + `multipart/form-data`
    - `grok-imagine-video-1.5-preview` 继续走 `/v2/videos/generations`
    - 后台 API 接入助手与右侧 AI 助手都要以“结构化接入方案”为默认输出形态，而不是继续给纯散文式猜配置结果
  - `2026-06-17` 已完成 gray / production 环境同步能力发布与联调：
    - 后台新增“环境同步”页
    - 支持用户 / 服务商（含关联模型）双向预览与逐项同步
    - 服务器环境文件已补齐：
      - `XINGHUAN_ENVIRONMENT_SYNC_TOKEN`
      - `XINGHUAN_GRAY_API_BASE_URL`
      - `XINGHUAN_PRODUCTION_API_BASE_URL`
