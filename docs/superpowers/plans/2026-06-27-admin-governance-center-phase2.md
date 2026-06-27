# Governance Center Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 `组织与治理` 工作域第二阶段前端升级，把 `用户组` 和 `权限策略` 两个工作区从“已可用”提升为“统一、可读、可扩展的 Starlight 治理工作台”，并把美观、可读性、抗溢出和高频操作效率作为同级验收项。

**Architecture:** 继续复用现有账号 / 用户组 / 权限 / 会话的数据链路与分区模型，不重写后端主逻辑；前端侧通过新增治理页合同、概览条、稳定卡片墙、统一 rail、统一 savebar 和更清晰的状态区分完成第二阶段重画。先做 `用户组`，再做 `权限策略`，最后补文档和验证链。

**Tech Stack:** React 19、TypeScript、Vite、现有 `adminPermissionApi` / `mutate` 体系、CSS in `apps/admin/src/styles.css`、contract scripts in `scripts/verify-*.mjs`

---

## 范围

本批只处理：

- `apps/admin/src/admin-users-panel.tsx`
- `apps/admin/src/admin-user-groups-section.tsx`
- `apps/admin/src/admin-permissions-panel.tsx`
- `apps/admin/src/admin-permissions-group-rail.tsx`
- `apps/admin/src/admin-permissions-summary-strip.tsx`
- `apps/admin/src/admin-permissions-savebar.tsx`
- `apps/admin/src/styles.css`
- 对应合同脚本与设计文档

不在本批处理：

- 后台首页总览
- 账号管理完整 Inspector
- 用量分析新图表模块
- 会话页深度重画
- 后端新增聚合接口

## UI 硬约束

- 任何组名、说明、catalogId、节点 ID 都不能溢出到卡片外
- `用户组` 卡片桌面端优先形成稳定卡片墙，不依赖局部小滚动槽
- `权限策略` 左 rail 必须清晰，但主视觉应回到右侧编辑器
- 按钮区必须允许换行，不能出现按钮高度错乱和挤压不可读
- 选中态、允许态、禁用态、警告态必须清楚分色
- KPI / 摘要区必须服务于扫描和决策，不做装饰堆叠

## 实施顺序

1. 增加治理页第二阶段 Starlight 合同脚本
2. 重画 `UsersPanel` 顶部治理概览与 `用户组` 工作区
3. 重画 `权限策略` hero / rail / summary / savebar
4. 更新设计文档
5. 运行合同和 `@xinghuan/admin` 构建验证

## 2026-06-27 追加进展

- [x] 增强 `权限策略` hero 的治理上下文，补齐分组说明、最近保存时间和更新人展示。
- [x] 把影响面板扩展为四项稳定摘要，拆开“当前视图已禁用 / 当前分组总限制 / 当前保留项”。
- [x] 为每个权限域加入 section overview，先展示作用说明、前台隐藏效果和批量操作影响范围。
- [x] 为 RH / 节点能力权限卡片补齐元信息块与底部开关区，稳定长 ID 展示。
- [x] 补齐公共资源分类与条目的空列表提示。
- [x] 把 `账号管理` 升级为治理工作台结构，补齐创建轨道、概览摘要、巡检提示卡和表格工具条。
- [x] 把 `会话管理` 升级为治理工作台结构，补齐会话概览、状态提示卡和会话检查工具条。
- [x] 把 `成功用量驾驶舱` 升级为治理工作台结构，补齐治理摘要条与 overview 面板。
- [x] 为 `组织与治理` 落地总览首页，补齐域级说明和快速下钻入口。
