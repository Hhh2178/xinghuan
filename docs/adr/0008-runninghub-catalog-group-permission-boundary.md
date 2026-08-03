# ADR 0008：RunningHub 目录分组与权限边界

> **Status:** Accepted
> **Date:** 2026-08-03
> **Owners:** Admin / Canvas / Permissions / Runtime
> **Decision Scope:** RunningHub catalog / Provider governance / Permission subjects
> **Supersedes:** None

## Context

RunningHub 应用与工作流目录原本只按 Provider 平铺，后台无法在大量条目中进行分组治理，画布节点也无法沿用后台的组织方式。仅在前端分组会造成灰度、生产和权限目录不一致；仅在条目上增加权限又无法表达“整组关闭”的运营语义。

## Decision

RunningHub app and workflow groups are Provider-scoped metadata stored in `xh_providers.rh_groups`; entries retain their existing catalog and execution IDs and carry only an optional `groupId`. Missing or invalid group IDs normalize to `未分组`.

Group access is an outer authorization gate. For grouped entries, effective access is `groupAllowed && itemAllowed`; an item rule cannot reopen a denied or disabled group. Ungrouped entries keep the existing item decision. Deleting a group atomically moves its entries to ungrouped.

## Alternatives

仅做前端临时分组会丢失跨端一致性；把分组建成独立数据库表会增加迁移与查询复杂度，但当前 Provider JSON 目录已是权威配置边界，因此先将分组作为 Provider 内的结构化元数据保存，并通过独立 permission subject 接入现有权限平台。

## Consequences

- Admin and Canvas can show the same canonical grouping without changing execution targets.
- Group subjects are reconciled separately from item subjects and use the existing permission platform.
- Legacy providers and entries remain compatible because groups and `groupId` are optional.
- Gray and Production must promote the same sealed archive after authenticated acceptance.

## Verification

Focused permission truth-table tests、subject registrar tests、Provider repository tests、Admin/Canvas catalog tests、类型检查和 `verify:runninghub-group-permission-contract` 必须通过；Authenticated Gray acceptance remains a release gate.

## Migration And Rollback

Migration `048_runninghub_catalog_groups.sql` adds a JSONB column with an empty-array default. Existing providers and entries normalize to an empty group list and ungrouped entries. Rollback keeps the prior catalog behavior by disabling the new group routes/UI and restoring the previous archive; do not delete existing provider data.
