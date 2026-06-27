import { useMemo, useState } from "react";
import { FolderTree, Search, Users2 } from "lucide-react";
import { FormPanel, StatusPill } from "./admin-common-components";
import type { AdminGroupPermissionPolicy, AdminUser, AdminUserGroup } from "./admin-types";

type AdminMutate = (
  path: string,
  payload: Record<string, unknown>,
  method?: string,
  options?: { suppressGlobalError?: boolean; rethrow?: boolean },
) => Promise<void> | void;

export function AdminUserGroupsSection({
  users,
  userGroups,
  permissionPolicies,
  mutate,
}: {
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  permissionPolicies: AdminGroupPermissionPolicy[];
  mutate: AdminMutate;
}) {
  const [groupForm, setGroupForm] = useState({ name: "", description: "", sortOrder: 0 });
  const [groupFormError, setGroupFormError] = useState("");
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; description: string; sortOrder: number }>>({});
  const [groupSearch, setGroupSearch] = useState("");

  const sortedGroups = useMemo(
    () => [...userGroups].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN")),
    [userGroups],
  );

  const groupMemberCount = useMemo(() => {
    const next = new Map<string, number>();
    for (const user of users) {
      const key = user.groupId || "ungrouped";
      next.set(key, (next.get(key) || 0) + 1);
    }
    return next;
  }, [users]);

  const groupPolicySummary = useMemo(() => {
    const next = new Map<string, { resources: number; runningHub: number; nodes: number }>();
    for (const policy of permissionPolicies) {
      next.set(policy.groupId, {
        resources: policy.deny.sharedResourceCategoryIds.length + policy.deny.sharedResourceItemIds.length,
        runningHub: policy.deny.runningHubAppCatalogIds.length + policy.deny.runningHubWorkflowCatalogIds.length,
        nodes: policy.deny.nodeTypes.length,
      });
    }
    return next;
  }, [permissionPolicies]);

  const visibleGroups = useMemo(
    () =>
      sortedGroups.filter((group) =>
        [group.name, group.description, group.id].join(" ").toLowerCase().includes(groupSearch.trim().toLowerCase()),
      ),
    [groupSearch, sortedGroups],
  );
  const totalRestrictedGroups = useMemo(
    () => sortedGroups.filter((group) => {
      const summary = groupPolicySummary.get(group.id);
      return Boolean(summary && (summary.resources || summary.runningHub || summary.nodes));
    }).length,
    [groupPolicySummary, sortedGroups],
  );

  function groupDraft(group: AdminUserGroup) {
    return groupDrafts[group.id] || { name: group.name, description: group.description, sortOrder: group.sortOrder };
  }

  async function handleCreateGroup() {
    setGroupFormError("");
    try {
      await mutate("/api/admin/user-groups", groupForm, "POST", {
        suppressGlobalError: true,
        rethrow: true,
      });
      setGroupForm({ name: "", description: "", sortOrder: 0 });
    } catch (nextError) {
      setGroupFormError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  return (
    <div className="users-group-workbench users-group-workbench--starlight">
      <section className="panel-stack users-group-workbench__rail">
        <FormPanel title="新建用户组" icon={FolderTree}>
          <div className="users-group-create-card">
            <label className="users-group-create-card__field">
              <span>分组名称</span>
              <input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
            </label>
            <label className="users-group-create-card__field">
              <span>分组说明</span>
              <input value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
            </label>
            <label className="users-group-create-card__field">
              <span>排序值</span>
              <input
                type="number"
                value={String(groupForm.sortOrder)}
                onChange={(e) => setGroupForm({ ...groupForm, sortOrder: Number(e.target.value) || 0 })}
              />
            </label>
            {groupFormError ? <div className="form-error">{groupFormError}</div> : null}
            <button type="button" onClick={() => void handleCreateGroup()}>创建分组</button>
          </div>
        </FormPanel>
      </section>

      <section className="data-panel users-group-list-panel users-group-workbench__main">
        <header>
          <Users2 aria-hidden="true" />
          <h2>分组概览</h2>
        </header>
        <div className="users-group-list-panel__body">
          <div className="users-group-workbench__summary">
            <div>
              <span>分组总数</span>
              <strong>{sortedGroups.length}</strong>
            </div>
            <div>
              <span>当前结果</span>
              <strong>{visibleGroups.length}</strong>
            </div>
            <div>
              <span>存在限制</span>
              <strong>{totalRestrictedGroups}</strong>
            </div>
          </div>
          <label className="toolbar-search users-group-search">
            <Search aria-hidden="true" />
            <input
              placeholder="搜索分组"
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
            />
          </label>
          <div className="users-group-grid">
            {visibleGroups.map((group) => {
              const draft = groupDraft(group);
              const policy = groupPolicySummary.get(group.id);
              const memberCount = groupMemberCount.get(group.id) || 0;
              const cannotDelete = memberCount > 0;
              return (
                <div className="user-group-card" key={group.id}>
                  <div className="user-group-card__head">
                    <div>
                      <strong>{group.name}</strong>
                      <p>{group.description || "当前分组暂无说明。"}</p>
                    </div>
                    <StatusPill tone={memberCount ? "warning" : "muted"}>{memberCount} 人</StatusPill>
                  </div>
                  <div className="user-group-card__summary users-group-card__summary">
                    <div className="user-group-card__meta">
                      <span>资源限制 {policy?.resources || 0}</span>
                      <span>RH 限制 {policy?.runningHub || 0}</span>
                      <span>节点限制 {policy?.nodes || 0}</span>
                      <span>排序 {group.sortOrder}</span>
                    </div>
                    <small>{cannotDelete ? "该分组仍有关联成员，删除前需先迁移成员。" : "当前分组可直接调整或删除。"}</small>
                  </div>
                  <div className="user-group-card__editor">
                    <label>
                      <span>分组名称</span>
                      <input
                        value={draft.name}
                        onChange={(e) => setGroupDrafts({
                          ...groupDrafts,
                          [group.id]: { ...draft, name: e.target.value },
                        })}
                      />
                    </label>
                    <label>
                      <span>分组说明</span>
                      <input
                        value={draft.description}
                        onChange={(e) => setGroupDrafts({
                          ...groupDrafts,
                          [group.id]: { ...draft, description: e.target.value },
                        })}
                      />
                    </label>
                    <label>
                      <span>排序值</span>
                      <input
                        type="number"
                        value={String(draft.sortOrder)}
                        onChange={(e) => setGroupDrafts({
                          ...groupDrafts,
                          [group.id]: { ...draft, sortOrder: Number(e.target.value) || 0 },
                        })}
                      />
                    </label>
                  </div>
                  <div className="row-actions user-group-card__actions">
                    <div className="user-group-card__action-row users-group-card__action-row">
                      <button
                        type="button"
                        onClick={() => mutate(`/api/admin/user-groups/${group.id}`, draft, "PATCH")}
                      >
                        保存分组
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        disabled={cannotDelete}
                        title={cannotDelete ? "该分组仍有关联用户，暂时不能删除" : "删除分组"}
                        onClick={() => mutate(`/api/admin/user-groups/${group.id}`, {}, "DELETE")}
                      >
                        删除分组
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
