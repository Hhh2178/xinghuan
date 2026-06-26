import { useEffect, useMemo, useState } from "react";
import { FolderTree, Plus, Search, Users2 } from "lucide-react";
import { adminPermissionApi } from "./admin-api-client";
import { AdminPermissionsPanel } from "./admin-permissions-panel";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import type {
  AdminGroupPermissionPolicy,
  AdminPermissionCatalog,
  AdminSessionRecord,
  AdminUser,
  AdminUserGroup,
  GroupPermissionDeny,
} from "./admin-types";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => Promise<void> | void;
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
  const [form, setForm] = useState({ email: "", name: "", role: "member", password: "", groupId: "", remark: "" });
  const [groupForm, setGroupForm] = useState({ name: "", description: "", sortOrder: 0 });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; description: string; sortOrder: number }>>({});
  const [groupSearch, setGroupSearch] = useState("");
  const [permissionCatalog, setPermissionCatalog] = useState<AdminPermissionCatalog | null>(null);
  const [permissionPolicies, setPermissionPolicies] = useState<AdminGroupPermissionPolicy[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const enabledCount = users.filter((user) => !user.disabled).length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const activeSessionCount = sessions.filter((session) => !session.revokedAt).length;
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

  function groupDraft(group: AdminUserGroup) {
    return groupDrafts[group.id] || { name: group.name, description: group.description, sortOrder: group.sortOrder };
  }

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

      {activeTab === "accounts" ? (
        <div className="users-tab-stack">
          <FormPanel title="新增成员" icon={Plus}>
            <input placeholder="邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
            <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              <option value="">未分组</option>
              {sortedGroups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <input placeholder="账号备注" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            <input placeholder="初始密码" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" onClick={() => mutate("/api/admin/users", form)}>创建用户</button>
          </FormPanel>

          <AdminTable title="账号列表">
            <thead>
              <tr>
                <th>邮箱</th>
                <th>名称</th>
                <th>所属组</th>
                <th>备注</th>
                <th>角色</th>
                <th>状态</th>
                <th>当前密码</th>
                <th>重置密码</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td title={user.email}>{user.email}</td>
                  <td>{user.name}</td>
                  <td>
                    <select
                      className="table-select"
                      value={user.groupId || ""}
                      onChange={(event) => mutate(`/api/admin/users/${user.id}`, { groupId: event.target.value }, "PATCH")}
                    >
                      <option value="">未分组</option>
                      {sortedGroups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="inline-edit inline-edit--wide">
                      <input
                        placeholder="账号备注"
                        value={remarks[user.id] ?? user.remark ?? ""}
                        onChange={(event) => setRemarks({ ...remarks, [user.id]: event.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => mutate(`/api/admin/users/${user.id}`, { remark: remarks[user.id] ?? user.remark ?? "" }, "PATCH")}
                      >
                        保存备注
                      </button>
                    </div>
                  </td>
                  <td>{user.role === "admin" ? "管理员" : "成员"}</td>
                  <td>
                    <StatusPill tone={user.disabled ? "danger" : "success"}>
                      {user.disabled ? "禁用" : "启用"}
                    </StatusPill>
                  </td>
                  <td>
                    {user.passwordAvailable ? (
                      <div className="user-password-cell">
                        <code>{user.password}</code>
                        <span>当前托管密码</span>
                      </div>
                    ) : (
                      <div className="user-password-cell unavailable">
                        <strong>暂不可查看</strong>
                        <span>旧账号需要先重置一次密码</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="inline-edit">
                      <input
                        placeholder="新密码"
                        type="password"
                        value={passwords[user.id] || ""}
                        onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const password = passwords[user.id];
                          if (!password) return;
                          mutate(`/api/admin/users/${user.id}`, { password }, "PATCH");
                          setPasswords({ ...passwords, [user.id]: "" });
                        }}
                      >
                        重置
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="user-row-actions">
                      <button
                        type="button"
                        onClick={() => mutate(`/api/admin/users/${user.id}`, { disabled: !user.disabled }, "PATCH")}
                      >
                        {user.disabled ? "启用" : "禁用"}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => mutate(`/api/admin/users/${user.id}`, {}, "DELETE")}
                      >
                        删除账号
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </div>
      ) : null}

      {activeTab === "groups" ? (
        <div className="users-group-workbench">
          <section className="panel-stack">
            <FormPanel title="新建用户组" icon={FolderTree}>
              <input placeholder="分组名称" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
              <input placeholder="分组说明" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
              <input
                placeholder="排序值"
                type="number"
                value={String(groupForm.sortOrder)}
                onChange={(e) => setGroupForm({ ...groupForm, sortOrder: Number(e.target.value) || 0 })}
              />
              <button type="button" onClick={() => mutate("/api/admin/user-groups", groupForm)}>创建分组</button>
            </FormPanel>

            <section className="data-panel users-group-list-panel">
              <header>
                <Users2 aria-hidden="true" />
                <h2>分组概览</h2>
              </header>
              <div className="users-group-list-panel__body">
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
                        <div className="user-group-card__meta">
                          <span>资源限制 {policy?.resources || 0}</span>
                          <span>RH 限制 {policy?.runningHub || 0}</span>
                          <span>节点限制 {policy?.nodes || 0}</span>
                          <span>排序 {group.sortOrder}</span>
                        </div>
                        <div className="user-group-card__editor">
                          <input
                            placeholder="分组名称"
                            value={draft.name}
                            onChange={(e) => setGroupDrafts({
                              ...groupDrafts,
                              [group.id]: { ...draft, name: e.target.value },
                            })}
                          />
                          <input
                            placeholder="分组说明"
                            value={draft.description}
                            onChange={(e) => setGroupDrafts({
                              ...groupDrafts,
                              [group.id]: { ...draft, description: e.target.value },
                            })}
                          />
                          <input
                            placeholder="排序值"
                            type="number"
                            value={String(draft.sortOrder)}
                            onChange={(e) => setGroupDrafts({
                              ...groupDrafts,
                              [group.id]: { ...draft, sortOrder: Number(e.target.value) || 0 },
                            })}
                          />
                        </div>
                        <div className="row-actions user-group-card__actions">
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
                    );
                  })}
                </div>
              </div>
            </section>
          </section>
        </div>
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

      {activeTab === "sessions" ? (
        <div className="users-tab-stack">
          <div className="api-card users-subhero">
            <div>
              <strong>当前会话</strong>
              <p>支持快速核对账号登录状态、来源设备与强制下线动作。</p>
            </div>
            <div className="users-subhero__chips">
              <StatusPill tone="success">{activeSessionCount} 个活跃</StatusPill>
              <StatusPill tone="muted">{sessions.filter((session) => session.revokedAt).length} 个已撤销</StatusPill>
            </div>
          </div>

          <AdminTable title="活跃会话">
            <thead>
              <tr>
                <th>账号</th>
                <th>角色</th>
                <th>登录时间</th>
                <th>最近活跃</th>
                <th>到期时间</th>
                <th>来源 IP</th>
                <th>客户端</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <div className="user-password-cell">
                      <strong>{session.userEmail}</strong>
                      <span>{session.userName}</span>
                    </div>
                  </td>
                  <td>{session.userRole === "admin" ? "管理员" : "成员"}</td>
                  <td>{new Date(session.createdAt).toLocaleString()}</td>
                  <td>{new Date(session.lastSeenAt).toLocaleString()}</td>
                  <td>{new Date(session.expiresAt).toLocaleString()}</td>
                  <td><code>{session.ip || "-"}</code></td>
                  <td title={session.userAgent || "-"}>{session.userAgent || "-"}</td>
                  <td>
                    <StatusPill tone={session.revokedAt ? "danger" : session.current ? "warning" : "success"}>
                      {session.revokedAt ? "已撤销" : session.current ? "当前会话" : "活跃"}
                    </StatusPill>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={session.current || Boolean(session.revokedAt)}
                      onClick={() => mutate(`/api/admin/sessions/${session.id}/revoke`, {}, "POST")}
                    >
                      {session.revokedAt ? "已撤销" : session.current ? "当前会话" : "强制下线"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        </div>
      ) : null}
    </section>
  );
}
