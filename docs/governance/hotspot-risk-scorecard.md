# 热点风险评分卡

本文件用于把“是否应该优先拆分”从单一行数判断，升级成更贴合当前项目的多维评分。

`1200+` watchlist 继续保留，但它的职责降级为：

- 报警线
- 入册线
- 治理触发器

它不再单独决定拆分优先级，也不再等同于“文件大就一定先拆”。

## 双轨治理

当前热点治理采用双轨制：

### 1. 行数轨

作用：

- 发现异常增长
- 触发入册
- 阻止新 giant file 悄悄长出来

当前仍保留：

- `800+` 新文件 soft limit
- `1000+` staged 跨线阻断
- `1200+` watchlist 入册
- 预算热点文件硬上限

### 2. 风险轨

作用：

- 决定真正的拆分顺序
- 决定本轮是否应该优先动某个热点文件
- 决定应该按哪种边界拆，而不是只按文件大小拆

## 评分维度

每个尚未完成改造的热点文件，按以下五个维度评分。

单项分值范围：

- `1` = 低
- `2` = 中低
- `3` = 中
- `4` = 中高
- `5` = 高

总分越高，说明越应该优先进入后续批次。

### 1. 职责密度

看这个文件是否同时承载多类职责，例如：

- UI 结构
- 状态管理
- 副作用 / 请求
- 运行态轮询
- 错误归一化
- 并发 / 取消
- 路由装配
- 数据落库

判断原则：

- `1-2`：职责单一
- `3`：有两到三类职责混合
- `4-5`：三类以上职责长期耦合

### 2. 变更耦合度

看这个文件是否在最近的需求和 bug 修复里被反复命中，而且每次都要改多个区域。

判断原则：

- `1-2`：很少改，或每次只改一个局部
- `3`：中频改动
- `4-5`：高频改动，且一改就牵涉多个职责块

### 3. 运行态风险

看这个文件是否处在关键链路上，例如：

- 任务执行
- 取消同步
- 状态回写
- 结果归一化
- 路由入口
- 队列与并发

判断原则：

- `1-2`：偏展示层或低风险工具层
- `3`：有部分运行态语义
- `4-5`：属于关键运行态入口

### 4. 性能与渲染敏感度

主要用于前端：

- 是否容易导致大范围重渲染
- 是否承载大块交互状态
- 是否影响画布、节点或模态的大面积刷新

判断原则：

- `1-2`：低频展示或静态数据
- `3`：中等交互敏感
- `4-5`：高频交互或画布核心渲染边界

### 5. 可拆分成熟度

看这个文件是否已经具备清晰拆分落点：

- section shell
- detail panel
- helper / hook
- route handler
- adapter / client
- dispatch / diagnostics

判断原则：

- `1-2`：边界不清，还需要大量摸底
- `3`：已有部分可拆 seams
- `4-5`：拆分边界已很清楚，适合进入下一批

说明：

- 这一项分数越高，越适合优先排期，因为风险更可控

## 分类治理

当前仓库热点文件不再混成一类处理，而是按下面四种类型治理：

### A. 编排入口型

典型：

- `apps/api/src/server.ts`
- `apps/worker/src/worker.ts`

默认拆法：

1. `route / entry handler`
2. `adapter / client`
3. `dispatch / queue`
4. `diagnostics / cancel-sync`

### B. 运行态节点型

典型：

- 大型节点组件

默认拆法：

1. `section shell`
2. `detail / param section`
3. `runtime / output section`
4. `submit / poll hook or service`

### C. 交互画布型

典型：

- `apps/web/src/components/Canvas.tsx`

默认拆法：

1. `runtime hooks`
2. `interaction sections`
3. `overlay panels`
4. `task/runtime subscriptions`

### D. 静态数据型

典型：

- `apps/web/src/data/portraitMasterOptions.ts`

默认拆法：

1. 按主题拆
2. 按能力拆
3. 按 registry 拆

这类文件的优先级不应该只因为行数大就高于关键运行态文件。

## 排序规则

后续真正的拆分顺序，按以下优先级判断：

1. 先看总分
2. 同分时优先运行态风险更高的文件
3. 再同分时优先可拆分成熟度更高的文件
4. 再同分时优先变更频率更高的文件

## 当前使用原则

- 已完成明显收口的文件，不因为新规则出台而回头做大规模重拆
- 新规则主要用于：
  - 排剩余热点的后续顺序
  - 决定下一批应该先收谁
  - 解释为什么某些文件虽然不算最大，但应该更早处理

## 与其他文档的关系

- 总纲：`AGENTS.md`
- 正式治理规范：`docs/governance/documentation-governance-standard.md`
- 工程护栏：`docs/governance/engineering-guardrails.md`
- 执行手册：`docs/governance/hotspot-decomposition-workflow.md`
- 当前热点台账：`docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md`
