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

- `D:/codex/无限画布2.0-worktrees/xinghuan-milestone-b`

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
- 不允许继续默认创造单一巨大的代码文件：
  - `server.ts`、`worker.ts`、大型节点组件、大型后台工作台页都视为热点入口
  - 新增协议执行优先拆 `client / adapter`
  - 新增并发或调度优先拆 `dispatch / queue`
  - 新增统一错误、取消、运行态逻辑优先拆 `diagnostics / cancel-sync`
  - 新增大型前端状态机优先拆 `hooks / sections / services`
  - 大型前端页面或节点默认优先按这个顺序拆：
    - `section shell`
    - `detail panel`
    - `helper / hook`
    - `save / submit service`
  - `1200+` watchlist 现在只是报警线和入册线，不再单独决定拆分优先级
  - 真实拆分顺序改按以下五个维度综合判断：
    - 职责密度
    - 变更耦合度
    - 运行态风险
    - 性能与渲染敏感度
    - 可拆分成熟度
  - 如果当前任务已经落在 `1200+` watchlist 文件上，本轮默认至少要完成一层真实下沉，不能只补台账或只改预算
  - 热点拆分批次默认要满足四件事同时成立：
    - 一层真实代码下沉
    - 一组可复用验证证据
    - 一份同步记录材料
    - 一个可回退的 clean commit
  - 动热点文件前，必须先说清：
    - 主文件本轮保留哪些职责
    - 本轮准备下沉哪一层
    - 新职责准备落到哪个文件类型
  - 默认一个提交只收一个热点文件，或一个紧耦合热点族；不鼓励把多个互不相关的超级文件混在一个提交里一起改
  - 对热点文件的真实下沉必须能指向明确落点：
    - 前端默认落到 `section shell / detail panel / hook / service`
    - 后端默认落到 `route handler / adapter / client / dispatch / diagnostics`
    - 交付说明里必须写清这轮到底把哪一层挪到了哪个文件
- 当单文件已经同时承载三类以上职责时，本轮任务必须同步拆分或明确记录拆分计划，不能只继续追加实现。
- 每轮准备提交或发布前，必须主动收口工作树：
  - 先看 `git status`
  - 再看本轮 `git diff --stat`
  - 无关改动、临时验证残留、重复脚本和半成品文档不得混入发布批次
  - 如果 staged / unstaged 混杂且无法在本轮解释清楚归属，必须先拆分提交或暂停发布，不能带着“顺手混进去”的状态继续推进
  - 默认批次收口标准：
    - 本轮热点文件改动要么已经 clean commit，要么在台账里明确说明剩余未收口范围
    - 不允许长期保留“功能已做完，但工作树一直混着临时验证残留”的状态
  - 热点批次收口前，默认还要补做一次：
    - `codegraph sync`
    - 相关 workspace 的 type-check / build
    - 对应 contract / verify 脚本
- 如果当前工作树很脏，但本轮只处理其中一部分，必须在台账或发布记录里明确“本轮实际归属改动范围”。
- 当前已落成可执行护栏：
  - `npm run verify:no-runtime-artifacts-staged`
  - `npm run verify:staged-source-size-guard`
  - `npm run verify:file-hotspot-budgets`
  - `npm run verify:hotspot-watchlist-contract`
  - `npm run verify:hotspot-doc-sync-staged`
  - `npm run verify:release-logbook-sync-staged`
  - `npm run verify:current-release-entry-consistency`
  - `pre-commit`
  - `npm run verify:release-worktree-clean`
  - `npm run verify:engineering-governance-contract`
- gray 发布流程当前会自动执行：
  - prepare 阶段：热点预算、`1200+` source watchlist 与工程治理 contract
  - deploy 阶段：工作树清洁检查
- gray / production 发布完成后，必须同步更新：
  - `docs/logbooks/releases/current-release-index.md`
  - 对应批次发布记录
  - `ops/README.md` 的当前运行态摘要
  - 对应的 `ops/current/gray.md` 或 `ops/current/production.md`
- 如果一次提交新增或修改了 `docs/logbooks/releases/gray/` 或 `docs/logbooks/releases/production/` 下的真实发布记录，那么同一次提交里必须同时包含：
  - `docs/logbooks/releases/current-release-index.md`
  - `ops/README.md`
  - 对应的 `ops/current/gray.md` 或 `ops/current/production.md`
  - 这条同步义务现在应通过提交前脚本执行，而不是只靠人工记忆
- 即使没有新发布记录，只要 `docs/logbooks/releases/current-release-index.md`、`ops/README.md`、`ops/current/gray.md`、`ops/current/production.md` 之间出现当前 release 漂移，也应被治理脚本直接判为不一致：
  - `npm run verify:current-release-entry-consistency`

## 超级文件后续规则

- 热点预算不是终点，只是止血线；进入预算清单的文件必须在后续计划中写出拆分目标和落点。
- 热点文件的真正优先级，不按纯行数排序，而按 `docs/governance/hotspot-risk-scorecard.md` 的综合评分排序。
- 任何 `apps/`、`packages/`、`scripts/` 下达到 `1200+` 行的 `.ts` / `.tsx` / `.js` / `.mjs` source 文件，都必须进入：
  - `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- 对这类 `1200+` 文件，至少要记录：
  - 当前职责
  - 当前风险
  - 下一步拆分目标
- 这条规则当前已有可执行校验：
  - `npm run verify:hotspot-watchlist-contract`
- 如果本轮 staged 改动触碰了热点文件或 watchlist 文件，提交前还必须留下对应台账 / 日志 / 计划材料：
  - `npm run verify:hotspot-doc-sync-staged`
- 运行产物、本机构建结果、缓存目录提交前也会被拦截：
  - `npm run verify:no-runtime-artifacts-staged`
- 新的 source 文件在提交前还有软上限保护：
  - `npm run verify:staged-source-size-guard`
- 这条提交前拦截由 `.githooks/pre-commit` 执行。
- 如果本轮没有拆分热点文件，但对其继续做了功能改动，必须在：
  - 对应发布记录
  - 或 `docs/superpowers/plans/`
  - 或 `docs/records/`
  里写明下一步拆分路线。
- 对前端热点文件，下一步拆分路线不能只写抽象名词，至少要明确：
  - 先拆哪一个 section
  - 哪些逻辑继续留在主文件
  - 下一层准备下沉到 `component / hook / helper / service` 的哪一种
- 不允许长期依赖“只更新预算，不推进拆分”的方式维持工程健康。
- 当前已完成主要收口的热点文件，默认不因为新评分规则出台而回头做大规模重拆；新规则主要用于剩余热点的后续排期和批次顺序。

## 版本治理规则

- 当前活跃版本已推进为 `v0.5.25`。
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

- 当前活跃版本：`v0.5.25`
- 当前生产版本：`v0.5.22`
- 当前灰度：`canvas-next.hhh2121.xyz` / `127.0.0.1:18200`
- 当前灰度 release：`20260704-comfyui-machine-first-gray-r1-v0525`
- 当前灰度状态：`2026-07-04 已完成 gray deploy + runtime verify；统一 comfyui 节点的 machine-first 选择、自适应高度与错误翻译链路已发布到 gray，并保持本机 ComfyUI 实例接入`
- 当前生产：`canvas.hhh2121.xyz` / `127.0.0.1:18100`
- 当前生产 release：`20260702-envsync-admin-sections-prod-r1-v0522`
- 当前生产状态：`2026-07-02 已完成 production deploy + runtime verify`
- 当前工作重心：ComfyUI 节点真实业务验收、机器池与工作流治理、项目级 harness、主入口状态收口
- 详细阶段历史、逐日证据和运行态细节统一看 `docs/memory/`、`docs/logbooks/`、`ops/README.md`
