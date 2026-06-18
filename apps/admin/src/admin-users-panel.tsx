import { useMemo, useState } from "react";
import { FolderTree, Plus } from "lucide-react";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import type { AdminSessionRecord, AdminUser, AdminUserGroup } from "./admin-types";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

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
  const [form, setForm] = useState({ email: "", name: "", role: "member", password: "", groupId: "", remark: "" });
  const [groupForm, setGroupForm] = useState({ name: "", description: "", sortOrder: 0 });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; description: string; sortOrder: number }>>({});
  const enabledCount = users.filter((user) => !user.disabled).length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const activeSessionCount = sessions.filter((session) => !session.revokedAt).length;
  const sortedGroups = useMemo(
    () => [...userGroups].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN")),
    [userGroups],
  );

  function groupDraft(group: AdminUserGroup) {
    return groupDrafts[group.id] || { name: group.name, description: group.description, sortOrder: group.sortOrder };
  }

  return (
    <section className="panel-stack users-page">
      <div className="api-card users-hero">
        <div>
          <strong>成员与权限</strong>
          <p>在这里创建后台账号、调整角色，并快速处理分组、备注、密码重置与启停状态。</p>
        </div>
        <div className="users-hero-metrics">
          <span>{users.length} 个账号</span>
          <span>{enabledCount} 个启用</span>
          <span>{adminCount} 个管理员</span>
          <span>{activeSessionCount} 个活跃会话</span>
        </div>
      </div>

      <div className="users-layout">
        <div className="users-create-column users-side-stack">
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

          <FormPanel title="用户组管理" icon={FolderTree}>
            <input placeholder="分组名称" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
            <input placeholder="分组说明" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
            <input
              placeholder="排序值"
              type="number"
              value={String(groupForm.sortOrder)}
              onChange={(e) => setGroupForm({ ...groupForm, sortOrder: Number(e.target.value) || 0 })}
            />
            <button type="button" onClick={() => mutate("/api/admin/user-groups", groupForm)}>创建分组</button>
            <div className="user-groups-list">
              {sortedGroups.map((group) => {
                const draft = groupDraft(group);
                return (
                  <div className="user-group-row" key={group.id}>
                    <div className="user-group-row__header">
                      <strong>{group.name}</strong>
                      <span>{users.filter((user) => user.groupId === group.id).length} 个成员</span>
                    </div>
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
                    <div className="row-actions user-group-row__actions">
                      <button
                        type="button"
                        onClick={() => mutate(`/api/admin/user-groups/${group.id}`, draft, "PATCH")}
                      >
                        保存分组
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => mutate(`/api/admin/user-groups/${group.id}`, {}, "DELETE")}
                      >
                        删除分组
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormPanel>
        </div>

        <AdminTable title="用户与权限">
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
                <td>{user.email}</td>
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
    </section>
  );
}
