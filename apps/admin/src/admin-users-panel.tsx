import { useEffect, useState } from "react";
import { adminPermissionApi } from "./admin-api-client";
import { AdminUserAccountsSection } from "./admin-user-accounts-section";
import { AdminUserGroupsSection } from "./admin-user-groups-section";
import { AdminUserSessionsSection } from "./admin-user-sessions-section";
import { AdminPermissionsPanel } from "./admin-permissions-panel";
import type {
  AdminGroupPermissionPolicy,
  AdminPermissionCatalog,
  AdminSessionRecord,
  AdminUser,
  AdminUserGroup,
  GroupPermissionDeny,
} from "./admin-types";

type AdminMutate = (
  path: string,
  payload: Record<string, unknown>,
  method?: string,
  options?: { suppressGlobalError?: boolean; rethrow?: boolean },
) => Promise<void> | void;
type UsersViewTab = "accounts" | "groups" | "permissions" | "sessions";

const USER_TABS: Array<{ id: UsersViewTab; label: string }> = [
  { id: "accounts", label: "账号" },
  { id: "groups", label: "用户组" },
  { id: "permissions", label: "权限" },
  { id: "sessions", label: "会话" },
];

export function UsersPanel({
  users,
  userGroups,
  sessions,
  mutate,
}: {
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  sessions: AdminSessionRecord[];
  mutate: AdminMutate;
}) {
  const [activeTab, setActiveTab] = useState<UsersViewTab>("accounts");
  const [permissionCatalog, setPermissionCatalog] = useState<AdminPermissionCatalog | null>(null);
  const [permissionPolicies, setPermissionPolicies] = useState<AdminGroupPermissionPolicy[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const enabledCount = users.filter((user) => !user.disabled).length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const activeSessionCount = sessions.filter((session) => !session.revokedAt).length;

  async function loadPermissionsData() {
    setPermissionsLoading(true);
    setPermissionsError("");
    try {
      const [catalog, policies] = await Promise.all([
        adminPermissionApi.readCatalog(),
        adminPermissionApi.listPolicies(),
      ]);
      setPermissionCatalog(catalog);
      setPermissionPolicies(policies);
      setPermissionsLoaded(true);
    } catch (nextError) {
      setPermissionsError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setPermissionsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "permissions") return;
    if (permissionsLoaded) return;
    void loadPermissionsData();
  }, [activeTab, permissionsLoaded]);

  useEffect(() => {
    setPermissionCatalog(null);
    setPermissionPolicies([]);
    setPermissionsLoaded(false);
  }, [userGroups.length]);

  async function handleSavePolicy(groupId: string, deny: GroupPermissionDeny) {
    const saved = await adminPermissionApi.updatePolicy(groupId, { deny });
    setPermissionPolicies((current) => {
      const others = current.filter((item) => item.groupId !== groupId);
      return [...others, saved].sort((left, right) => left.groupId.localeCompare(right.groupId, "zh-CN"));
    });
  }

  return (
    <section className="panel-stack users-page">
      <div className="api-card users-hero">
        <div>
          <strong>账号、分组与权限治理</strong>
          <p>这里负责账号创建、用户组维护、分组权限隐藏策略以及后台会话治理，不再把所有功能挤在同一条窄侧栏里。</p>
        </div>
        <div className="users-hero-metrics">
          <span>{users.length} 个账号</span>
          <span>{enabledCount} 个启用</span>
          <span>{adminCount} 个管理员</span>
          <span>{userGroups.length} 个用户组</span>
          <span>{activeSessionCount} 个活跃会话</span>
        </div>
      </div>

      <div className="users-view-tabs" role="tablist" aria-label="账号治理导航">
        {USER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "accounts" ? <AdminUserAccountsSection users={users} userGroups={userGroups} mutate={mutate} /> : null}

      {activeTab === "groups" ? (
        <AdminUserGroupsSection
          users={users}
          userGroups={userGroups}
          permissionPolicies={permissionPolicies}
          mutate={mutate}
        />
      ) : null}

      {activeTab === "permissions" ? (
        <AdminPermissionsPanel
          catalog={permissionCatalog}
          policies={permissionPolicies}
          loading={permissionsLoading}
          error={permissionsError}
          onReload={loadPermissionsData}
          onSavePolicy={handleSavePolicy}
        />
      ) : null}

      {activeTab === "sessions" ? <AdminUserSessionsSection sessions={sessions} mutate={mutate} /> : null}
    </section>
  );
}
