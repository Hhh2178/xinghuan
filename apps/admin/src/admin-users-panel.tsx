import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import type { AdminUser } from "./main";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

export function UsersPanel({ users, mutate }: { users: AdminUser[]; mutate: AdminMutate }) {
  const [form, setForm] = useState({ email: "", name: "", role: "member", password: "" });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  return (
    <section className="panel-stack">
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
      <AdminTable title="用户与权限">
        <thead><tr><th>邮箱</th><th>名称</th><th>角色</th><th>状态</th><th>重置密码</th><th>操作</th></tr></thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.name}</td>
              <td>{user.role === "admin" ? "管理员" : "成员"}</td>
              <td><StatusPill tone={user.disabled ? "danger" : "success"}>{user.disabled ? "禁用" : "启用"}</StatusPill></td>
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
                <button type="button" onClick={() => mutate(`/api/admin/users/${user.id}`, { disabled: !user.disabled }, "PATCH")}>
                  {user.disabled ? "启用" : "禁用"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </section>
  );
}
