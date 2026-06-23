# RunningHub / Worker / Admin / Canvas Governance Design

## 背景

当前项目已经具备 RunningHub、普通 Provider、后台 Admin、前端画布、任务队列与 Worker 的基本闭环，但系统正在进入“功能能跑、协作变复杂、运行态风险开始显性化”的阶段。

截至 `2026-06-23`，已经确认的核心问题包括：

- RunningHub 多 Key 抢占在并发竞争下仍会出现“有余量但提前 busy / 排队”
- RH 节点与 RH Tools 节点的“停止”更多只是停本地轮询，不等于真实取消后端任务
- RunningHub 轮询分支的非 JSON 容错仍不完整
- production 与 gray 当前仍共用 `xinghuan_canvas_next`
- `worker.ts`、`server.ts`、`RunningHubNode.tsx`、`admin-runninghub-workspace.tsx` 已进入结构过载区
- 后台分析出的 `requestExample / responseExample / outputDraft / executionDraft` 与前端真实执行链路仍有断层
- 统一运行态诊断字段已经进入后端，但前端消费仍偏薄

这意味着当前最需要的不是继续堆功能，而是做一次有顺序、有边界、可灰度、可回滚的治理工程。

## 目标

本轮治理工程的总目标是：

1. 先修正已经影响真实业务体验的运行时问题
2. 再把 Worker、RunningHub 和 RH 节点相关的结构热点拆薄
3. 最后完成 production / gray 运行边界隔离和运行态可观测补全

这轮治理不是一次性大重构，而是一个分三阶段推进的工程治理项目。

## 非目标

本轮明确不追求：

- 一次性重写 Worker 或 API 主文件
- 同时大改前端视觉、后台布局、协议接入和环境切换
- 为了“看起来整洁”而进行大规模无收益改名 / 搬目录
- 在未建立契约脚本前直接做大范围结构拆分

## 总体原则

### 1. 先止血，再收口，再隔离

先修真实业务问题，再做结构治理，最后做环境隔离与诊断增强。

### 2. 每个阶段都必须独立可验证

每个阶段都要能：

- 单独开发
- 单独灰度
- 单独验收
- 单独回滚

### 3. 不并行叠加三类高风险改动

不允许在同一轮里同时做：

- 前端 RH 节点大改
- Worker 结构大拆
- production 切库 / 切队列

### 4. 统一契约优先于局部“感觉一致”

跨层协作字段必须通过共享类型、契约脚本和只读诊断视图校验，不再靠人工推测一致性。

### 5. 验收职责明确

- Agent 负责：代码、链路、契约、运行态、灰度 / 正式发布验证
- 用户负责：视觉、交互、真实业务体验验收

## 分阶段方案

推荐固定执行顺序：

1. `Phase A` 运行时止血
2. `Phase B` 结构收口
3. `Phase C` 环境隔离与运行态补全

## Phase A：运行时止血

### 目标

只修已经影响真实业务体验的点，不做大范围结构重构。

### 范围

#### A1. RunningHub 多 Key 抢占修正

当前问题：

- Worker 先选 Key，再占位
- 如果选中的 Key 在竞争中占位失败，当前就直接返回 busy
- 不会继续尝试下一把仍有余量的 Key

设计要求：

- 保持“默认 Key 优先”
- 单个 Key 抢占失败后继续尝试后续 Key
- 只有所有 Key 都满时才返回 `all_keys_busy`
- 对外字段保持兼容：
  - `preferredRhKeyId`
  - `assignedRhKeyId`
  - `assignedRhKeyNoteSnapshot`
  - `assignedRhKeyMaxConcurrency`
  - `rhQueueReason`

预期结果：

- 修复“还有余量却提前排队”的真实问题
- 让 RunningHub Key 池能力在业务上真正成立

#### A2. RH 节点 / RH Tools 节点接入真实取消

当前问题：

- 画布“停止”更多是停本地轮询
- 后端任务和上游任务未必被真正取消

设计要求：

- 节点取消要区分：
  - 停止本地轮询
  - 取消真实任务
- 节点侧统一接入真实 cancel API
- 后端继续统一走 `cancelTaskWithStrategy`
- Worker 和任务查询结果继续通过 `cancelState` 同步最终状态

预期结果：

- 消除“画布停了但后台还在跑”的错觉
- 让取消状态在画布、后台、Worker、上游之间闭环

#### A3. RunningHub 轮询 JSON 容错补齐

当前问题：

- submit 分支已有非 JSON 保护
- poll 分支成功返回 200 但 body 非 JSON 时，会退化成普通异常

设计要求：

- 对 poll 分支补齐 `try/catch`
- 非 JSON success / gateway 页 / 空响应统一映射为：
  - `failureCategory`
  - `providerDiagnostic`
  - `upstreamHttpStatus`
  - `upstreamResponseSnippet`

预期结果：

- 前后端和后台能拿到一致的失败口径
- 提升 RH 问题的排障效率

### Phase A 边界

明确不做：

- production 分库
- `worker.ts` 大结构拆分
- RH 执行规则改成 descriptor 驱动
- RH 节点视觉结构重构

### Phase A 验收标准

代码 / 契约层：

- 多 Key 在竞争场景下继续尝试后续 Key
- 节点取消能真正打到后端 cancel API
- RH poll 非 JSON 会落到统一失败诊断
- RH 主提交 / 轮询 / 输出回填链路不回归

用户验收层：

- RH 多 Key 不再提前排队
- 点击取消后，后台任务状态和画布状态一致
- RH 出错时节点提示更可解释

## Phase B：结构收口

### 目标

把未来最容易继续出问题的结构热点拆薄，让系统恢复清晰边界。

### 范围

#### B1. `worker.ts` 退回 orchestration glue

设计要求：

- `worker.ts` 只保留：
  - 取任务
  - 执行器选择
  - 统一运行态写回
  - 收尾与取消协同

不再直接承载：

- RunningHub 协议 submit / poll 细节
- Key 池调度细节
- 统一失败归一化细节
- 取消同步细节

#### B2. RunningHub 拆成 `client + dispatch`

拆分建议：

- `worker-runninghub-client`
  - submit workflow
  - submit app
  - poll
  - parse outputs
  - upstream error mapping

- `worker-runninghub-dispatch`
  - 默认 Key 优先
  - fallback Key 尝试
  - Redis 并发窗口占位 / 释放
  - `all_keys_busy`
  - legacy 单 Key 兼容

设计目标：

- 协议调用复杂度和并发调度复杂度彻底分开

#### B3. 统一运行态与取消同步抽成公共 helper

拆分建议：

- `worker-runtime-diagnostics`
  - `failureCategory`
  - `providerDiagnostic`
  - `upstreamHttpStatus`
  - `upstreamResponseSnippet`
  - patch merge 规则

- `worker-cancel-sync`
  - 本地取消
  - 后台取消
  - 上游取消
  - provider 已取消后的结果回写

设计目标：

- 所有 provider 共用同一套失败 / 取消口径

#### B4. RH 节点共享运行时逻辑

设计要求：

- `RunningHubNode` 与 `RHToolsNode` 共享：
  - submit
  - poll / resume
  - cancel
  - output reset
  - displayLabel 策略
  - 上游媒体字段处理

设计目标：

- 修一边，另一边不再漏
- RH 节点族行为保持一致

### Phase B 边界

明确不做：

- production 切库
- 新的 RH 协议功能扩展
- 后台视觉改版

### Phase B 验收标准

代码 / 契约层：

- `worker.ts` 明显变薄
- RunningHub 的 client / dispatch 独立成文件
- 统一失败与取消逻辑可单独测试
- RH / RH Tools 关键运行逻辑共享，不再双份散落

用户体感：

- 同类问题回归减少
- RH 节点行为更一致
- 后续修 bug 更稳

## Phase C：环境隔离与运行态补全

### 目标

解决运行边界不清和可解释性不足的问题。

### 范围

#### C1. production 与 gray 真正分库、分队列

设计要求：

- production 不再指向 `xinghuan_canvas_next`
- production 使用独立数据库名
- production 使用独立 Redis 队列前缀
- release gate 增加硬阻断：
  - production 不允许继续指向 gray 库
  - production 队列名不允许与 gray 相同

#### C2. 前端完整消费统一运行态诊断

设计要求：

- 节点 UI 和任务侧板补充：
  - `failureCategory`
  - `providerDiagnostic`
  - `cancelState`
  - `upstreamHttpStatus`
- 展示分层：
  - 普通用户看简化信息
  - 管理 / 调试视角看完整诊断

#### C3. 后台分析草案与真实执行链路对齐

设计要求：

- 增加 drift 检查：
  - 分析字段 vs fetchInfo 字段
  - outputDraft vs 实际结果类型
- 明确草案状态：
  - 草案已生成
  - 草案已验证
  - 草案与真实运行目标存在漂移

#### C4. 系统只读诊断视图增强

建议增强内容：

- RH Key 池总并发
- 默认 Key
- 各 Key 实时占用
- queue reason 分布
- 最近 `failureCategory` 分布
- 当前 production / gray 目标库、队列、版本

### Phase C 边界

- 不与 Phase B 结构拆分并行上线
- 分库切换必须有单独回滚预案
- 上线前必须先做数据快照和只读验证

### Phase C 验收标准

运行态与可观测性层：

- production / gray 库、队列完全隔离
- 前端和后台对同一任务的诊断字段一致
- RH 分析草案有 drift 提示
- 系统页能读到真实生效运行态

## 风险与取舍

### 方案选择

推荐方案固定为：

- 先 `Phase A`
- 再 `Phase B`
- 最后 `Phase C`

原因：

- 先止血最符合当前业务状态
- 结构重构应在链路稳定后进行
- 环境隔离风险最大，应放在运行逻辑稳定之后

### 关键取舍

- Phase A 接受在旧结构上做少量补丁，以换取快速止血
- Phase B 优先收口结构边界，不追求同时增加新能力
- Phase C 单独做环境切换，避免把“切库风险”和“代码结构调整”叠加

## 契约与验证要求

所有阶段都必须补或复用相应契约脚本，重点覆盖：

- RunningHub 多 Key 动态选择
- 节点取消与后端取消同步
- RH poll 非 JSON 容错
- unified runtime diagnostics
- RH 节点共享运行时逻辑
- production / gray 环境隔离 gate

## 建议输出物

这份设计之后应继续产出：

1. 详细实施计划文档
2. 分阶段执行清单
3. 契约脚本清单
4. gray / production 放行清单

## 结论

当前项目最合适的治理方式不是一次性大重构，而是按 `A -> B -> C` 三阶段推进：

- `Phase A` 修真实业务问题
- `Phase B` 收口结构边界
- `Phase C` 完成环境隔离与可观测补全

这是当前风险最低、验证最清楚、最适合持续灰度和持续验收的治理路线。
