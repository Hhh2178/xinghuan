import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import type { AdminUser } from "./admin-types";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

export function UsersPanel({ users, mutate }: { users: AdminUser[]; mutate: AdminMutate }) {
  const [form, setForm] = useState({ email: "", name: "", role: "member", password: "" });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const enabledCount = users.filter((user) => !user.disabled).length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  return (
    <section className="panel-stack users-page">
      <div className="api-card users-hero">
        <div>
          <strong>成员与权限</strong>
          <p>在这里创建后台账号、调整角色，并快速处理密码重置与启停状态。</p>
        </div>
        <div className="users-hero-metrics">
          <span>{users.length} 个账号</span>
          <span>{enabledCount} 个启用</span>
          <span>{adminCount} 个管理员</span>
        </div>
      </div>

      <div className="users-layout">
        <div className="users-create-column">
          <FormPanel title="新增成员" icon={Plus}>
            <input placeholder="邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
            <input placeholder="初始密码" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" onClick={() => mutate("/api/admin/users", form)}>创建用户</button>
          </FormPanel>
        </div>

        <AdminTable title="用户与权限">
          <thead>
            <tr>
              <th>邮箱</th>
              <th>名称</th>
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
                  <button
                    type="button"
                    onClick={() => mutate(`/api/admin/users/${user.id}`, { disabled: !user.disabled }, "PATCH")}
                  >
                    {user.disabled ? "启用" : "禁用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </div>
    </section>
  );
}
