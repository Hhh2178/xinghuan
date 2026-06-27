import { useMemo, useState } from "react";
import { ChevronDown, KeyRound, Plus, ShieldCheck, UserCog, Users } from "lucide-react";
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const sortedGroups = useMemo(
    () => [...userGroups].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-CN")),
    [userGroups],
  );
  const enabledCount = useMemo(() => users.filter((user) => !user.disabled).length, [users]);
  const disabledCount = users.length - enabledCount;
  const adminCount = useMemo(() => users.filter((user) => user.role === "admin").length, [users]);
  const groupedCount = useMemo(() => users.filter((user) => user.groupId).length, [users]);
  const passwordManagedCount = useMemo(() => users.filter((user) => user.passwordAvailable).length, [users]);

  function generateStrongPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%&*?";
    const all = `${upper}${lower}${digits}${symbols}`;
    const seed = new Uint32Array(18);
    crypto.getRandomValues(seed);
    const required = [upper, lower, digits, symbols].map((pool, index) => pool[seed[index] % pool.length]);
    const rest = Array.from(seed.slice(required.length), (value) => all[value % all.length]);
    const password = [...required, ...rest]
      .sort((left, right) => all.indexOf(left) - all.indexOf(right) + Math.random() - 0.5)
      .join("");
    setForm((current) => ({ ...current, password }));
  }

  function groupNameFor(user: AdminUser) {
    if (!user.groupId) return "未分组";
    return sortedGroups.find((group) => group.id === user.groupId)?.name || "未分组";
  }

  return (
    <div className="users-accounts-workbench users-accounts-workbench--starlight">
      <section className="panel-stack users-accounts-create-rail">
        <FormPanel title="新增成员" icon={Plus}>
          <div className="users-create-stack-card">
            <label className="users-create-stack-card__field">
              <span>邮箱</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="users-create-stack-card__field">
              <span>名称</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="users-create-stack-card__field">
              <span>角色</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="member">成员</option>
                <option value="admin">管理员</option>
              </select>
            </label>
            <label className="users-create-stack-card__field">
              <span>所属分组</span>
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">未分组</option>
                {sortedGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <label className="users-create-stack-card__field">
              <span>账号备注</span>
              <input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            </label>
            <label className="users-create-stack-card__field">
              <span>初始密码</span>
              <div className="users-create-stack-card__password-row">
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={generateStrongPassword}>生成强密码</button>
              </div>
            </label>
            <button type="button" onClick={() => mutate("/api/admin/users", form)}>创建用户</button>
          </div>
        </FormPanel>
      </section>

      <section className="panel-stack users-accounts-main">
        <div className="api-card users-subhero">
          <div>
            <strong>账号治理工作台</strong>
            <p>集中管理成员分组、备注、密码托管状态和启停动作，避免高频操作只挤在单一表格里。</p>
          </div>
          <div className="users-subhero__chips">
            <StatusPill tone="success">{enabledCount} 个启用</StatusPill>
            <StatusPill tone="warning">{adminCount} 个管理员</StatusPill>
            <StatusPill tone="muted">{disabledCount} 个禁用</StatusPill>
          </div>
        </div>

        <div className="users-accounts-summary" aria-label="账号治理概览">
          <div>
            <span>账号总数</span>
            <strong>{users.length}</strong>
          </div>
          <div>
            <span>已分组成员</span>
            <strong>{groupedCount}</strong>
          </div>
          <div>
            <span>管理员</span>
            <strong>{adminCount}</strong>
          </div>
          <div>
            <span>密码可托管</span>
            <strong>{passwordManagedCount}</strong>
          </div>
        </div>

        <div className="users-account-card-grid">
          <div className="users-account-card">
            <div className="users-account-card__head">
              <div>
                <strong>账号启用结构</strong>
                <p>帮助你快速判断当前是否存在大量停用成员或临时冻结账号。</p>
              </div>
              <Users aria-hidden="true" />
            </div>
            <div className="users-account-card__metrics">
              <span>启用 {enabledCount}</span>
              <span>禁用 {disabledCount}</span>
              <span>未分组 {users.length - groupedCount}</span>
            </div>
          </div>
          <div className="users-account-card">
            <div className="users-account-card__head">
              <div>
                <strong>权限风险提示</strong>
                <p>管理员、未分组成员和不可查看密码账号，通常是最需要优先扫一遍的对象。</p>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>
            <div className="users-account-card__metrics">
              <span>管理员 {adminCount}</span>
              <span>未分组 {users.length - groupedCount}</span>
              <span>密码不可见 {users.length - passwordManagedCount}</span>
            </div>
          </div>
        </div>

        <AdminTable
          title="账号列表"
          tableWrapClassName="users-accounts-table-panel"
          toolbar={(
            <div className="users-account-table-toolbar">
              <div>
                <strong>批量检查入口</strong>
                <span>优先检查未分组账号、密码不可见账号和已禁用账号，避免遗漏权限和维护状态。</span>
              </div>
              <div className="permission-row__chips">
                <span><UserCog aria-hidden="true" /> 组归属</span>
                <span><KeyRound aria-hidden="true" /> 密码治理</span>
                <span><ShieldCheck aria-hidden="true" /> 启停状态</span>
              </div>
            </div>
          )}
        >
          <tr>
            <th>账号工作台</th>
          </tr>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="users-account-record">
                  <div className="users-account-record__summary-row">
                    <div className="users-account-record__summary-cell users-account-record__summary-cell--account">
                      <span>账号</span>
                      <strong title={user.email}>{user.email}</strong>
                      <small>{user.name}</small>
                    </div>
                    <div className="users-account-record__summary-cell">
                      <span>密码</span>
                      <strong>{user.passwordAvailable ? user.password : "暂不可查看"}</strong>
                    </div>
                    <div className="users-account-record__summary-cell">
                      <span>备注</span>
                      <strong>{remarks[user.id] ?? user.remark ?? "未填写"}</strong>
                    </div>
                    <div className="users-account-record__summary-cell">
                      <span>归属组</span>
                      <strong>{groupNameFor(user)}</strong>
                    </div>
                    <button
                      type="button"
                      className="users-account-record__toggle"
                      onClick={() => setExpandedUserId((current) => (current === user.id ? null : user.id))}
                      aria-expanded={expandedUserId === user.id}
                    >
                      <ChevronDown aria-hidden="true" />
                      {expandedUserId === user.id ? "收起管理" : "展开管理"}
                    </button>
                  </div>

                  {expandedUserId === user.id ? (
                    <div className="users-account-record__details">
                      <div className="users-account-record__identity">
                        <div className="users-account-record__identity-copy">
                          <strong title={user.email}>{user.email}</strong>
                          <span>{user.name}</span>
                        </div>
                        <div className="users-account-record__chips">
                          <StatusPill tone={user.role === "admin" ? "warning" : "muted"}>
                            {user.role === "admin" ? "管理员" : "成员"}
                          </StatusPill>
                          <StatusPill tone={user.disabled ? "danger" : "success"}>
                            {user.disabled ? "禁用" : "启用"}
                          </StatusPill>
                        </div>
                      </div>

                      <div className="users-account-record__grid">
                        <label className="users-account-record__field">
                          <span>所属组</span>
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
                        </label>

                        <label className="users-account-record__field users-account-record__field--span-2">
                          <span>备注</span>
                          <div className="inline-edit inline-edit--wide">
                            <input
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
                        </label>

                        <div className="users-account-record__field">
                          <span>当前密码</span>
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
                        </div>

                        <label className="users-account-record__field">
                          <span>重置密码</span>
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
                        </label>
                      </div>

                      <div className="user-row-actions">
                        <button
                          type="button"
                          onClick={() => mutate(`/api/admin/users/${user.id}`, { disabled: !user.disabled }, "PATCH")}
                        >
                          {user.disabled ? "启用账号" : "禁用账号"}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => mutate(`/api/admin/users/${user.id}`, {}, "DELETE")}
                        >
                          删除账号
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
