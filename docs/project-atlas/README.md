# 项目总纲（Project Atlas）

这是无限画布 2.0 给 AI、协作者和后续维护者准备的第一跳总纲。

目标不是替代所有文档，而是先回答四个问题：

1. 这个项目现在的主入口在哪里
2. 项目的结构、运行环境、接口和执行链路分别看哪份
3. 当前状态、长期记忆、逐日台账和运维记录分别看哪份
4. 出问题时应该从哪条排障路径开始

## 先看什么

如果你刚接手当前 worktree，推荐顺序：

1. `README.md`
2. `AGENTS.md`
3. `docs/project-atlas/README.md`
4. `MEMORY.md`
5. `ops/README.md`
6. `DEVLOG.md`

## 总纲地图

- `architecture.md`
  - 仓库结构、应用边界、共享层和任务执行链路
- `runtime-and-env.md`
  - 本地 / 灰度 / 生产的运行环境、域名、端口、部署目录和关键环境变量边界
- `interfaces-and-dataflow.md`
  - 核心 API、后台接口、任务队列和主要数据流
- `debugging-playbook.md`
  - 常见问题分类、优先检查项、定位命令和近期真实根因样本
- `server-maintenance-and-healthchecks.md`
  - 服务器连接、服务检查、gray/prod 健康检查顺序、发布后复核和常见运行态异常入手
- `logbook-maintenance.md`
  - `DEVLOG` / `ops` / `changelog` 三类台账如何维护
- `document-routing-and-cleanliness.md`
  - 文档路由、归档、运行产物边界和保持仓库干净的规则

## 与主入口的分工

- `README.md`
  - 当前工作根和高层状态摘要
- `AGENTS.md`
  - 协作规则、入口路由、更新义务、阅读顺序
- `MEMORY.md`
  - 长期有效的项目记忆、部署状态、当前 release 和长期风险
- `DEVLOG.md`
  - 逐日推进、验证、部署、回滚台账
- `ops/README.md`
  - 当前运行态和灰度/生产/回滚记录入口

## 更新触发条件

出现以下变化时，必须同步更新至少一份 `project-atlas` 文档：

- 仓库结构或目录职责变化
- 运行环境、域名、端口、部署目录变化
- 核心接口或任务执行链路变化
- 排障路径、常见根因、验证顺序发生变化
- 台账维护方式、归档方式、仓库清洁规则变化

## 维护原则

- 总纲只做“如何找到正确文件”的压缩镜像，不复制整本历史。
- 分域手册只保留长期有效或高频复用知识，不承接逐日流水。
- 如果某段内容已经变成版本细节、灰度记录或某一天的排障经过，就应回到：
  - `DEVLOG.md`
  - `ops/*.md`
  - `docs/prd/v0.1.0/changelog.md`

## 当前建议

从今天开始，AI 不应再试图只靠 `MEMORY.md` 独自恢复全局；优先走这套总纲入口，再进入具体分域手册。
