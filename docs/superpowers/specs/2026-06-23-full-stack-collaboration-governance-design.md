# Full-Stack Collaboration Governance Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把前端画布、后台 Admin、API、Worker、RunningHub 的协作边界收口成可验证、可分层、可灰度的治理结构。

**Architecture:** 先统一运行态与取消态，再把 RunningHub 协作链拆成分析、目录、执行、展示四层，最后把 API / Worker / Canvas / Admin 的超大入口文件拆成更小的职责单元。整个过程以契约脚本、只读审查、灰度验证和文档收口为主线。

**Tech Stack:** TypeScript, React, Node.js, PostgreSQL, Redis, RunningHub, CodeGraph, RTK

---

## 现状判断

- `server.ts`、`worker.ts`、`Canvas.tsx`、`RunningHubNode.tsx`、`RHToolsNode.tsx`、`admin-runninghub-workspace.tsx`、`admin-api-settings-panel.tsx` 都已经进入“一个文件扛太多职责”的阶段。
- RunningHub 的分析结果、运行目标、Key 池和节点执行行为之间仍有漂移。
- 多个节点的停止逻辑本质上还是本地轮询停止，不是统一的真实取消。
- production 与 gray 的环境边界还没完全分离。

## 设计目标

1. 让“配置”“分析”“执行”“取消”“展示”各自有边界。
2. 让 RH / RH Tools / 其他任务节点共享同一套运行时口径。
3. 让后台看到的草案和前端实际执行的规则尽量同源。
4. 让 production / gray 的数据边界、队列边界、发布边界清楚可查。

## 分层方案

### 1. 运行态层

- 统一 `status`
- 统一 `progress`
- 统一 `failureCategory`
- 统一 `providerDiagnostic`
- 统一 `cancelState`

### 2. 协议层

- RunningHub 分成 `analysis`、`catalog`、`execution descriptor`
- `requestExample` / `responseExample` 只作为分析输入，不直接等同于真实执行规则

### 3. 节点层

- `RunningHubNode` 和 `RHToolsNode` 共享 submit / poll / cancel / reset / label 逻辑
- 节点只关心渲染与交互，不再各自维护一套协议细节
- 高级区统一使用中性的 `runTargetId / targetType` 语义，不再继续把统一运行目标包装成 `webappId` 心智

### 4. 后台层

- 工作台保留目录编辑、分析、Key 池管理
- 分析区和目录区分开
- 草案状态必须明确标识是否已生效、是否与真实运行目标漂移
- 后台草案里的 `execution` / `outputSchema` 需要成为前端真实运行时的直接输入，而不是只做展示材料

### 5. 环境层

- gray 与 production 必须分库、分队列、分放行记录
- release gate 必须能硬阻断错误环境

## 关键原则

- 先修真实运行问题，再做结构拆分。
- 不在同一轮里同时做前端大改、Worker 大拆、环境切换。
- 任何跨层字段都必须有共享契约或只读诊断入口。

## 验收标准

- 用户能明确区分“停止轮询”和“真实取消”。
- RunningHub 分析、目录、执行不再混成一团。
- 前端与后台对同一个任务的状态解释一致。
- production 与 gray 的运行边界可被脚本和运维记录验证。
