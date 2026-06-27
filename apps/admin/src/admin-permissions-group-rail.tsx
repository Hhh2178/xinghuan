import { Search, ShieldCheck } from "lucide-react";
import { StatusPill } from "./admin-common-components";
import type { AdminGroupPermissionPolicy, AdminUserGroup, GroupPermissionDeny } from "./admin-types";

export function AdminPermissionsGroupRail({
  groups,
  groupSearch,
  onGroupSearchChange,
  selectedGroupId,
  onSelectGroup,
  policyMap,
  summarizeDeny,
}: {
  groups: AdminUserGroup[];
  groupSearch: string;
  onGroupSearchChange: (value: string) => void;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  policyMap: Map<string, AdminGroupPermissionPolicy>;
  summarizeDeny: (deny?: GroupPermissionDeny) => GroupPermissionDeny;
}) {
  return (
    <section className="data-panel permissions-groups-panel permissions-groups-panel--starlight">
      <header>
        <ShieldCheck aria-hidden="true" />
        <h2>权限分组</h2>
      </header>
      <div className="permissions-groups-panel__body">
        <label className="toolbar-search permissions-search">
          <Search aria-hidden="true" />
          <input
            placeholder="搜索分组"
            value={groupSearch}
            onChange={(event) => onGroupSearchChange(event.target.value)}
          />
        </label>
        <div className="permissions-group-list">
          {groups.map((group) => {
            const policy = policyMap.get(group.id);
            const summary = summarizeDeny(policy?.deny);
            const selected = selectedGroupId === group.id;
            return (
              <button
                type="button"
                key={group.id}
                className={selected ? "permissions-group-card active" : "permissions-group-card"}
                onClick={() => onSelectGroup(group.id)}
              >
                <div className="permissions-group-card__title">
                  <strong className="permissions-group-card__name">{group.name}</strong>
                  <StatusPill tone={selected ? "warning" : "muted"}>{policy?.memberCount || 0} 人</StatusPill>
                </div>
                <p>{group.description || "当前分组暂无说明"}</p>
                <div className="permissions-group-card__stats">
                  <span>资源 {summary.sharedResourceCategoryIds.length + summary.sharedResourceItemIds.length}</span>
                  <span>RH {summary.runningHubAppCatalogIds.length + summary.runningHubWorkflowCatalogIds.length}</span>
                  <span>节点 {summary.nodeTypes.length}</span>
                </div>
              </button>
            );
          })}
          {!groups.length ? <div className="permissions-empty-card">没有匹配的分组。</div> : null}
        </div>
      </div>
    </section>
  );
}
