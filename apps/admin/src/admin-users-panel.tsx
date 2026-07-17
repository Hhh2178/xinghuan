import { Activity, KeyRound, ShieldCheck, Users2 } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { adminPermissionApi } from "./admin-api-client";
import { AdminWorkspaceBand } from "./admin-common-components";
import { AdminUserAccountsSection } from "./admin-user-accounts-section";
import { AdminUserGroupsSection } from "./admin-user-groups-section";
import { AdminUserSessionsSection } from "./admin-user-sessions-section";
import type {
  AdminGroupPermissionPolicy,
  AdminSessionRecord,
  AdminUser,
  AdminUserGroup,
} from "./admin-types";
import type { AdminUsersViewId } from "./admin-view-model";

type AdminMutate = (
  path: string,
  payload: Record<string, unknown>,
  method?: string,
  options?: { suppressGlobalError?: boolean; rethrow?: boolean },
) => Promise<void> | void;
type UsersViewTab = AdminUsersViewId;

const PermissionPlatformPanel = lazy(() =>
  import("./permission-platform/panel").then((module) => ({
    default: module.PermissionPlatformPanel,
  })),
);

const USER_TABS: Array<{ id: UsersViewTab; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "accounts", label: "账号" },
  { id: "groups", label: "用户组" },
  { id: "permissions", label: "权限" },
  { id: "sessions", label: "会话" },
];

export function UsersPanel({
  initialView = "overview",
  activeView,
  onViewChange,
  showLocalNavigation = true,
  users,
  userGroups,
  sessions,
  onOpenAudit,
  mutate,
}: {
  initialView?: UsersViewTab;
  activeView?: UsersViewTab;
  onViewChange?: (viewId: UsersViewTab) => void;
  showLocalNavigation?: boolean;
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  sessions: AdminSessionRecord[];
  onOpenAudit?: () => void;
  mutate: AdminMutate;
}) {
  const [activeTab, setActiveTab] = useState<UsersViewTab>(initialView);
  const currentView = activeView || activeTab;
  const [permissionPolicies, setPermissionPolicies] = useState<AdminGroupPermissionPolicy[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const enabledCount = users.filter((user) => !user.disabled).length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const activeSessionCount = sessions.filter((session) => !session.revokedAt).length;
  const revokedSessionCount = sessions.filter((session) => session.revokedAt).length;
  const memberCount = users.filter((user) => user.role !== "admin").length;
  const ungroupedCount = users.filter((user) => !user.groupId).length;
  const disabledCount = users.filter((user) => user.disabled).length;

  const restrictedGroupCount = useMemo(
    () =>
      permissionPolicies.filter((policy) => {
        const deny = policy.deny;
        return Boolean(
          deny.sharedResourceCategoryIds.length ||
          deny.sharedResourceItemIds.length ||
          deny.runningHubAppCatalogIds.length ||
          deny.runningHubWorkflowCatalogIds.length ||
          deny.nodeTypes.length,
        );
      }).length,
    [permissionPolicies],
  );

  const permissionRestrictedTotal = useMemo(
    () =>
      permissionPolicies.reduce((total, policy) => (
        total +
        policy.deny.sharedResourceCategoryIds.length +
        policy.deny.sharedResourceItemIds.length +
        policy.deny.runningHubAppCatalogIds.length +
        policy.deny.runningHubWorkflowCatalogIds.length +
        policy.deny.nodeTypes.length
      ), 0),
    [permissionPolicies],
  );

  useEffect(() => {
    if (activeView) return;
    setActiveTab(initialView);
  }, [activeView, initialView]);

  function selectView(viewId: UsersViewTab) {
    setActiveTab(viewId);
    onViewChange?.(viewId);
  }

  async function loadPermissionsData() {
    setPermissionsLoading(true);
    try {
      const policies = await adminPermissionApi.listPolicies();
      setPermissionPolicies(policies);
      setPermissionsLoaded(true);
    } catch {
      setPermissionsLoaded(false);
    } finally {
      setPermissionsLoading(false);
    }
  }

  useEffect(() => {
    if (currentView !== "permissions" && currentView !== "overview") return;
    if (permissionsLoaded) return;
    void loadPermissionsData();
  }, [currentView, permissionsLoaded]);

  useEffect(() => {
    setPermissionPolicies([]);
    setPermissionsLoaded(false);
  }, [userGroups.length]);

  return (
    <section className="panel-stack users-page users-page--starlight">
      <AdminWorkspaceBand
        className="users-band"
        kicker="Governance Center"
        title="账号、分组与权限治理"
        description="这里负责账号创建、用户组维护、分组权限隐藏策略以及后台会话治理，不再把所有功能挤在同一条窄侧栏里。"
        currentLabel={USER_TABS.find((tab) => tab.id === currentView)?.label || "总览"}
        currentDescription={`${users.length} 个账号 · ${userGroups.length} 个用户组 · ${activeSessionCount} 个活跃会话`}
        actions={
          <div className="users-band__metrics">
            <span>{enabledCount} 个启用</span>
            <span>{adminCount} 个管理员</span>
            <span>{restrictedGroupCount} 个限制组</span>
            <span>{activeSessionCount} 个活跃会话</span>
          </div>
        }
      />

      <div className="users-governance-summary" aria-label="组织治理概览">
        <div>
          <span>账号总数</span>
          <strong>{users.length}</strong>
        </div>
        <div>
          <span>普通成员</span>
          <strong>{memberCount}</strong>
        </div>
        <div>
          <span>管理员</span>
          <strong>{adminCount}</strong>
        </div>
        <div>
          <span>未分组</span>
          <strong>{ungroupedCount}</strong>
        </div>
        <div>
          <span>活跃会话</span>
          <strong>{activeSessionCount}</strong>
        </div>
      </div>

      {showLocalNavigation ? <div className="users-view-tabs" role="tablist" aria-label="账号治理导航">
        {USER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={currentView === tab.id ? "active" : ""}
            onClick={() => selectView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div> : null}

      {currentView === "overview" ? (
        <div className="users-governance-overview">
          <div className="users-governance-overview__hero api-card">
            <div>
              <span>Governance Center</span>
              <strong>组织与治理总览</strong>
              <p>先看账号、分组、权限、会话和审计的整体态势，再进入具体工作区处理变更和巡检。</p>
            </div>
            <div className="permission-row__chips">
              <span>{users.length} 个账号</span>
              <span>{userGroups.length} 个用户组</span>
              <span>{restrictedGroupCount} 个限制组</span>
              <span>{activeSessionCount} 个活跃会话</span>
            </div>
          </div>

          <div className="users-governance-quick-grid">
            <button type="button" className="users-governance-quick-card" onClick={() => selectView("accounts")}>
              <div className="users-governance-quick-card__head">
                <Users2 aria-hidden="true" />
                <strong>账号管理</strong>
              </div>
              <p>处理账号创建、组归属、备注、密码和启停状态。</p>
              <div className="users-governance-quick-card__stats">
                <span>启用 {enabledCount}</span>
                <span>禁用 {disabledCount}</span>
                <span>未分组 {ungroupedCount}</span>
              </div>
            </button>

            <button type="button" className="users-governance-quick-card" onClick={() => selectView("groups")}>
              <div className="users-governance-quick-card__head">
                <Users2 aria-hidden="true" />
                <strong>用户组管理</strong>
              </div>
              <p>维护分组结构、成员分配和分组基础信息。</p>
              <div className="users-governance-quick-card__stats">
                <span>总组数 {userGroups.length}</span>
                <span>普通成员 {memberCount}</span>
                <span>未分组 {ungroupedCount}</span>
              </div>
            </button>

            <button type="button" className="users-governance-quick-card" onClick={() => selectView("permissions")}>
              <div className="users-governance-quick-card__head">
                <ShieldCheck aria-hidden="true" />
                <strong>权限策略</strong>
              </div>
              <p>控制公共资源、RH 条目和节点能力的开放范围。</p>
              <div className="users-governance-quick-card__stats">
                <span>限制组 {restrictedGroupCount}</span>
                <span>限制项 {permissionRestrictedTotal}</span>
                <span>{permissionsLoading ? "同步中" : "目录就绪"}</span>
              </div>
            </button>

            <button type="button" className="users-governance-quick-card" onClick={() => selectView("sessions")}>
              <div className="users-governance-quick-card__head">
                <Activity aria-hidden="true" />
                <strong>会话管理</strong>
              </div>
              <p>核查在线状态、来源设备和远端会话下线风险。</p>
              <div className="users-governance-quick-card__stats">
                <span>活跃 {activeSessionCount}</span>
                <span>已撤销 {revokedSessionCount}</span>
                <span>当前在线 {sessions.filter((session) => session.current && !session.revokedAt).length}</span>
              </div>
            </button>

            <button type="button" className="users-governance-quick-card" onClick={() => onOpenAudit?.()}>
              <div className="users-governance-quick-card__head">
                <KeyRound aria-hidden="true" />
                <strong>审计与用量</strong>
              </div>
              <p>查看成功用量驾驶舱、模型与 RH 条目排行，以及后台审计记录。</p>
              <div className="users-governance-quick-card__stats">
                <span>驾驶舱已接入</span>
                <span>成功任务统计</span>
                <span>审计可下钻</span>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {currentView === "accounts" ? <AdminUserAccountsSection users={users} userGroups={userGroups} mutate={mutate} /> : null}

      {currentView === "groups" ? (
        <AdminUserGroupsSection
          users={users}
          userGroups={userGroups}
          permissionPolicies={permissionPolicies}
          mutate={mutate}
        />
      ) : null}

      {currentView === "permissions" ? (
        <Suspense fallback={<div className="starlight-page-loading">正在加载统一权限平台...</div>}>
          <PermissionPlatformPanel users={users} userGroups={userGroups} />
        </Suspense>
      ) : null}

      {currentView === "sessions" ? <AdminUserSessionsSection sessions={sessions} mutate={mutate} /> : null}
    </section>
  );
}
