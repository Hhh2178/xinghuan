# 热点拆分执行流程

本文件用于把“如何真实拆热点文件、如何保持工作树整洁、如何形成可回退批次”固定成一套执行流程。

它不是替代 `AGENTS.md` 或 `engineering-guardrails.md`，而是把两者里的规则收口成每一批都能照着执行的操作手册。

## 适用场景

当本轮任务满足任一条件时，默认启用本流程：

- 触碰硬预算热点文件
- 触碰 `1200+` watchlist 文件
- 新增或修改可能继续放大主入口职责的页面、节点、路由、worker 编排文件
- 准备做 gray / production 前的工程收口

## 一批拆分的最低交付标准

一次合格的热点拆分批次，至少同时包含以下四类产物：

1. 一层真实代码下沉
2. 一组可复用验证证据
3. 一份同步记录材料
4. 一个可回退的 clean commit

如果只补文档、不改结构，或只改代码、不留验证与记录，都不算完成一批热点拆分。

## 固定执行顺序

### 1. 开工前先做边界检查

至少执行：

- `git status --short`
- `git diff --stat`
- `codegraph status`

目标：

- 判断当前工作树是否已混入无关改动
- 判断本轮是否应该先收口已有脏改动
- 判断当前热点文件的职责密度和影响面

如果当前工作树已经脏到无法解释本轮归属，默认先暂停功能推进，先拆分提交边界或记录本轮范围。

### 2. 先写清本轮准备拆哪一层

在动代码前，至少要能回答三个问题：

- 主文件本轮准备保留哪些职责
- 本轮准备下沉哪一层职责
- 新职责准备落到哪个文件类型

允许的标准落点：

- 前端：
  - `section shell`
  - `detail panel`
  - `hook`
  - `helper`
  - `service`
- 后端：
  - `route handler`
  - `adapter`
  - `client`
  - `dispatch`
  - `diagnostics`
  - `cancel-sync helper`

如果说不清这三个问题，不允许直接开始堆代码。

### 3. 一批默认只收一个热点或一个紧耦合热点族

默认原则：

- 一个 commit 优先只覆盖一个热点文件
- 或一个明确的紧耦合热点族

例如允许：

- `RunningHubNode.tsx` + 它的新 section/helper/contract
- `worker.ts` + 它拆出的 `dispatch`/`diagnostics` 子模块

默认不鼓励：

- 同一批同时混改多个互不相关的大文件
- 把治理脚本、发布记录、业务修复和多个热点拆分全部揉成一个提交

如果确实需要同批触碰两个以上热点文件，记录里必须写清它们为什么属于同一个收口动作。

### 4. 先拆组合层，再拆深逻辑

默认优先级固定如下：

- 前端：
  1. `section shell`
  2. `detail panel`
  3. `helper / hook`
  4. `submit / save / runtime service`
- 后端：
  1. `route / entry handler`
  2. `adapter / client`
  3. `dispatch / queue`
  4. `diagnostics / cancel-sync / runtime helper`

原因：

- 组合层先收口，能更快降低主文件体积和阅读压力
- 深逻辑后拆，能减少一轮把主链路改坏的概率

### 5. 验证必须跟着拆分一起生长

每一批至少要满足其中两类验证：

- 类型检查
- 构建
- 合约脚本
- 行为脚本
- 入口治理脚本

推荐顺序：

1. 新增或更新 contract 脚本
2. 跑对应 workspace 的 type-check / build
3. 跑热点治理脚本
4. 需要时再跑 release/worktree clean

目标不是“跑很多命令”，而是让后续同类拆分可以重复复用已有验证脚本。

### 6. 记录要写清主文件剩余职责

同步记录材料时，至少写清：

- 本轮下沉了什么
- 主文件还保留什么
- 下一轮最小拆分落点是什么

默认记录位置：

- `docs/logbooks/daily/`
- `docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
- 必要时补 `docs/systems/<system>/`

禁止只写“已优化”“已重构”这类没有信息量的描述。

### 7. 一批结束必须形成 clean commit

提交前至少再执行一次：

- `git status --short`
- `git diff --stat`
- `codegraph sync`

期望结果：

- 只剩本轮预期改动
- 没有临时脚本、运行产物、测试残留混入
- 提交后工作树回到 clean

如果本轮无法形成 clean commit，就不能把它表述成“已经收口完成”。

## 热点拆分批次模板

推荐在 daily log / ledger 中使用以下结构：

- 目标
- 变更
- 本轮下沉职责
- 主文件保留职责
- 验证
- 结果
- 下一步

这样做的目的，是让后续任何人都能快速看懂：

- 这一批到底动了哪一层
- 为什么没继续动更深一层
- 下一轮最自然的接续点在哪里

## 工作树整洁的硬要求

### 允许保留在工作树里的内容

- 本轮明确归属的源码改动
- 本轮明确归属的 contract / verify 脚本
- 本轮同步更新的文档和台账

### 不允许长期挂在工作树里的内容

- 临时调试文件
- 一次性实验脚本
- 运行日志与导出物
- 构建产物
- “后面可能有用”的半成品文档

如果某个临时文件确实需要保留，它要么进入正式目录并命名清楚，要么在本轮结束前删除。

## 回退策略

每一批热点拆分都必须天然支持回退：

- 提交粒度保持单一主题
- 新增文件命名反映职责
- contract 脚本和文档与代码同批提交
- 不把多个方向的改动混成一个 commit

这样即使后续发现问题，也能按提交边界精确回退，而不是重新从脏工作树里手工拆。

## 与其他规则的关系

- 总纲与项目级规则：`AGENTS.md`
- 正式治理规范：`docs/governance/documentation-governance-standard.md`
- 工程护栏与脚本入口：`docs/governance/engineering-guardrails.md`
- 当前热点台账：`docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`

如果本文件与旧的口头做法冲突，以本文件和工程脚本为准，不再沿用“先乱改、最后再收”的模式。
