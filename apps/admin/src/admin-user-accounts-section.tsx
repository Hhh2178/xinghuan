import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import type { AdminUser, AdminUserGroup } from "./admin-types";

type AdminMutate = (
  path: string,
  payload: Record<string, unknown>,
  method?: string,
  options?: { suppressGlobalError?: boolean; rethrow?: boolean },
) => Promise<void> | void;

export function AdminUserAccountsSection({
  users,
  userGroups,
  mutate,
}: {
  users: AdminUser[];
  userGroups: AdminUserGroup[];
  mutate: AdminMutate;
}) {
  const [form, setForm] = useState({ email: "", name: "", role: "member", password: "", groupId: "", remark: "" });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const sortedGroups = useMemo(
    () => [...userGroups].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN")),
    [userGroups],
  );

  return (
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
  );
}
