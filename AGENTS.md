# AGENTS.md - 无限画布 2.0 项目协作规则

## 项目定位

无限画布 2.0 是公司内部节点式 AIGC 创作平台的新立项项目。旧 `node-banana-enterprise` 项目不再作为产品主干，只作为失败经验、需求来源和迁移参考。

本项目目标是从一开始建立可扩展节点系统、独立后台、模型与服务商管理、云端项目存储、用户隔离、素材空间和任务执行链路，避免在节点基础薄弱的项目上继续补丁式改造。

## 项目总纲入口

从 Phase 1 文档治理重构开始，当前推荐阅读顺序改为：

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `README.md`
5. `MEMORY.md`
6. `ops/README.md`
7. `DEVLOG.md`

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

## 文件治理与归档规则

- 治理规则看 `docs/governance/`
- 系统知识看 `docs/systems/`
- 长期记忆看 `docs/memory/`
- 逐日台账与发布证据看 `docs/logbooks/`
- 设计与演进记录看 `docs/records/`

旧入口文件目前继续保留，但职责已经改成“摘要 + 跳转入口”：

- `README.md`
- `MEMORY.md`
- `DEVLOG.md`
- `ops/README.md`

## 当前目录约定

- `AGENTS.md`：本文件，记录协作和工程规则。
- `docs/INDEX.md`：新的第一跳总索引。
- `docs/governance/`：协作方式、CodeGraph 规则、归档政策。
- `docs/governance/documentation-governance-standard.md`：当前正式文档治理规范。
- `docs/systems/`：按系统组织的知识入口。
- `docs/memory/`：长期记忆主题目录。
- `docs/logbooks/`：日常推进、发布、验证、事故记录目录。
- `docs/records/`：设计方案与演进记录目录。
- `MEMORY.md`：长期项目记忆、关键决策、服务器和部署状态。
- `DEVLOG.md`：开发日志台账，按日期记录真实推进、测试和部署。
- `README.md`：当前工作根入口和高层状态摘要。
- `docs/project-atlas/README.md`：兼容层总纲入口，保留旧的结构化导航正文。
- `docs/project-atlas/*.md`：兼容层主题正文，新的主入口以 `docs/systems/`、`docs/governance/`、`docs/logbooks/` 为准。
- `docs/repo-structure.md`：当前 worktree、主仓库、过程目录和运行产物目录说明。
- `docs/runtime-artifacts.md`：运行产物目录和清理边界说明。
- `docs/documentation-governance.md`：旧治理入口兼容层，正式规范已迁到 `docs/governance/documentation-governance-standard.md`。
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
2. `docs/INDEX.md`
3. `docs/systems/README.md`
4. `README.md`
5. `MEMORY.md`
6. `ops/README.md`
7. `DEVLOG.md`
8. `docs/project-atlas/README.md`
9. `docs/repo-structure.md`
10. `docs/runtime-artifacts.md`

## 入口优先级

当前无限画布 2.0 的默认工作入口就是本目录：

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

使用原则：

- 当前开发、部署、验收、结构整理，优先看本目录下的 `AGENTS.md`、`docs/project-atlas/README.md`、`MEMORY.md`、`DEVLOG.md`、`docs/`、`ops/`
- 当前默认导航先走 `docs/INDEX.md -> docs/systems/<system>/ -> 代码`
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

## RTK 命令约定

- shell 检索、读文件、git 状态、diff、脚本执行默认优先使用 `rtk`
- 只有在以下场景才回退普通命令：
  - `rtk` 不支持该命令
  - 需要完整原始输出做精确诊断
  - 需要交互式实时输出
- 执行仓库校验、构建、契约脚本时，默认先尝试 `rtk <command>`

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

- 当前活跃版本已推进为 `v0.4.10`。
- 后续每一次 gray / production 真实发布，都必须推进一个非 major 版本号，不能继续长期复用同一个小版本。
- `major` 版本升级只能在用户明确下达升级指令后执行，协作过程中不得自行推进大版本。
- 同一批 release 的 gray 与 production 必须暴露相同的应用版本号，不能出现“同批发布但两个环境显示不同版本”的状态。
- 当 gray 的一批改动被确认同步到 production 时，gray 端显示的版本号也必须与 production 保持一致。

## 发布验证职责边界

- Agent 默认负责代码层、架构层和运行态层验证：
  - 版本推进与版本对齐
  - 构建、类型、契约、发布包边界校验
  - 远端部署、release 切换、服务重启
  - `current` 指针、systemd 状态、内网/公网 `api/status`、数据库目标等结构化运行态验证
  - 发布记录、主入口和运维入口同步
- Agent 默认不负责 gray / production 的视觉验收：
  - 页面观感、布局细节、文案观感
  - 交互顺滑度、视觉层对比
  - 业务输出是否“符合预期”的主观判断
- 上述视觉与人工体验验证默认由用户负责，除非用户明确要求 Agent 参与。
- 每轮发布汇报必须显式分成两类：
  - `Agent 已验证`
  - `待用户验收`
- 如果某项只完成了代码或运行态验证，Agent 不得把它表述成“灰度已完整验收”。

## 文档与归档规则

- 文档总入口以 `docs/INDEX.md` 为准。
- 治理规则与更新规范优先看 `docs/governance/`。
- 文档治理正式规范以 `docs/governance/documentation-governance-standard.md` 为准。
- `docs/project-atlas/README.md` 与 `docs/documentation-governance.md` 继续保留为兼容正文，不再作为唯一第一跳入口。
- 系统结构、协议、接口与执行链路优先收口到 `docs/systems/`，不要继续零散只写进 `MEMORY.md` 或一次性方案文档。
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

- 2.0 当前活跃版本已为 `v0.4.10`。
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
- 当前灰度 release：`20260623-runninghub-key-pool-progress-gray-r1-v0410`
  - `2026-06-23` 已完成 RH 工作台空白新建与画布输出残留 gray 热修：
    - 后台新建空白 `AI 应用 / 工作流` 不再因为默认启用而直接命中缺少输入槽错误
    - RH 工作台备注摘要块已增强视觉强调
    - RH / RH Tools 节点重复执行后会先清空旧输出，再写回本次新结果
    - gray 已实机点击验证 `新建 AI 应用 / 新建工作流` 成功且无报错
  - 当前生产 release：`20260619-runninghub-slot-sync-prod-r1-v040-local`
  - `2026-06-22` 已完成 RH 显式无入参工作流 gray 热修：
    - 后台 RH 工作台对 `allowsEmptyInputs=true` 的 workflow 不再显示“缺少输入槽”
    - 管理端保存/启用时不再误拦截 `nodeInfoList=[]` 的合法 workflow
    - gray 目标条目 `2064255815862800385` 已确认保持：
      - `allowsEmptyInputs = true`
      - `fields = 0`
      - `outputSchema[0].path = results`
  - `2026-06-22` 已完成 RunningHub App / Workflow 运行态归一化与 AI App v2 gray 发布：
    - RH public catalog 与节点运行态开始按 `kind` 纠正 `appId / workflowId / runTargetId` 归属
    - RH 节点会阻断 `app + workflowId` / `workflow + appId` 的混合态条目直接运行
    - RunningHub AI App worker submit/query 已切到官方 v2 协议
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
  - `2026-06-18` 已完成 RunningHub 运行时与队列治理 gray / production 发布：
    - RH catalog 规范化
    - 后台 RH 工作台与结构化条目编辑器
    - 前台单一 RH 节点固定 typed handles 与 `inputSlots` 优先消费过渡
    - RH query 结果读取已改为统一保留 `image/video/audio` 输出数组，避免按 capability 分支丢结果
    - RH queued task 入库已不再误把 workflow/page id 写入 `xh_tasks.model_id`
    - 普通 Provider 任务已验证用户级并发窗口与自动递进
    - RunningHub 任务已验证平台级并发窗口 `2` 与自动递进
    - gray / production gate 已通过：
      - `verify:release-preflight`
      - `verify:request-chain-observability`
      - `verify:system-observability`
    - 当前补记：
      - 本轮未包含新 migration
      - release 目录执行 `db:migrate` 仍暴露 `PG_DRIVER_NOT_INSTALLED`，后续凡是带 migration 的发布都必须先修补 release 迁移依赖链
  - `2026-06-19` 已完成 RH 条目真实输入槽同步并发布 gray / production：
    - 后台 RH 工作台新增“从运行目标同步输入槽”
    - 当 RH 运行目标能返回 `nodeInfoList` 时，后台条目可直接补齐真实 `nodeId / fieldName`
    - 画布 RH 节点随后按后台条目自动展开参数区，不再停留在 Schema 草稿态
