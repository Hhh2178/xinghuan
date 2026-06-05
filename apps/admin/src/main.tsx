import {
  Activity,
  Boxes,
  Database,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  PlayCircle,
  Plus,
  ServerCog,
  ShieldCheck,
  ScrollText,
  UserCog,
  Users,
} from "lucide-react";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type UserRole = "admin" | "member";
type Capability = "text" | "image" | "video" | "audio";
type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type TabId = "overview" | "users" | "providers" | "models" | "tasks" | "audit" | "system";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AdminUser extends AuthUser {
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ProviderRecord {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string;
  note: string;
  updatedAt: number;
}

interface ModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: Capability;
  enabled: boolean;
  inputProfile: string;
  parameterSchema: string;
  updatedAt: number;
}

interface TaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  providerId?: string;
  modelId?: string;
  logs: string[];
  updatedAt: number;
}

interface Summary {
  users: number;
  enabledUsers: number;
  providers: number;
  enabledProviders: number;
  models: number;
  enabledModels: number;
  tasks: number;
  runningTasks: number;
  auditLogs: number;
  environment: string;
  storage: { canvases: number; resources: number; inputFiles: number; outputFiles: number };
}

interface SystemInfo {
  environment: string;
  dataDir: string;
  storageDriver: string;
  database: {
    configured: boolean;
    status: string;
    serverTime?: string;
    migrations: string[];
    error: string;
  };
  redis: {
    configured: boolean;
    status: string;
    queue: string;
    depth: number;
    error: string;
  };
  authDbPath: string;
  adminDbPath: string;
  service: string;
  version: string;
  storage: Summary["storage"];
}

interface AuditRecord {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: number;
}

const navItems: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "users", label: "用户", icon: Users },
  { id: "providers", label: "Provider", icon: KeyRound },
  { id: "models", label: "模型", icon: Boxes },
  { id: "tasks", label: "任务", icon: Activity },
  { id: "audit", label: "审计", icon: ScrollText },
  { id: "system", label: "系统", icon: ServerCog },
];

function AdminApp() {
  const [authStatus, setAuthStatus] = useState<"checking" | "ready">("checking");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ authenticated: boolean; user: AuthUser | null }>("/api/auth/me")
      .then((data) => setCurrentUser(data.authenticated ? data.user : null))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthStatus("ready"));
  }, []);

  const isAdmin = currentUser?.role === "admin";

  async function loadAdminData() {
    if (!isAdmin) return;
    setBusy(true);
    setError("");
    try {
      const [nextSummary, nextUsers, nextProviders, nextModels, nextTasks, nextAuditLogs, nextSystem] = await Promise.all([
        api<Summary>("/api/admin/summary"),
        api<AdminUser[]>("/api/admin/users"),
        api<ProviderRecord[]>("/api/admin/providers"),
        api<ModelRecord[]>("/api/admin/models"),
        api<TaskRecord[]>("/api/admin/tasks"),
        api<AuditRecord[]>("/api/admin/audit"),
        api<SystemInfo>("/api/admin/system"),
      ]);
      setSummary(nextSummary);
      setUsers(nextUsers);
      setProviders(nextProviders);
      setModels(nextModels);
      setTasks(nextTasks);
      setAuditLogs(nextAuditLogs);
      setSystem(nextSystem);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, [isAdmin]);

  async function handleLogin(email: string, password: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ authenticated: boolean; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setCurrentUser(data.user);
    } catch {
      setError("登录失败，请检查账号和密码。");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentUser(null);
  }

  async function mutate(path: string, payload: Record<string, unknown>, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "checking") return <Splash />;
  if (!currentUser) return <LoginView busy={busy} error={error} onLogin={handleLogin} />;
  if (!isAdmin) return <ForbiddenView user={currentUser} onLogout={handleLogout} />;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-mark">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>星幻后台</strong>
            <span>{summary?.environment || "gray"}</span>
          </div>
        </div>
        <nav aria-label="后台模块">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                className={activeTab === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>统一后台</p>
            <h1>{titleFor(activeTab)}</h1>
          </div>
          <div className="topbar-actions">
            {busy ? <Loader2 className="spin" aria-hidden="true" /> : <span className="health-dot">API 已连接</span>}
            <span className="user-chip">
              <UserCog aria-hidden="true" />
              {currentUser.email}
            </span>
            <button type="button" className="icon-button" onClick={handleLogout} title="退出登录">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {activeTab === "overview" ? <Overview summary={summary} providers={providers} models={models} tasks={tasks} /> : null}
        {activeTab === "users" ? <UsersPanel users={users} mutate={mutate} /> : null}
        {activeTab === "providers" ? <ProvidersPanel providers={providers} mutate={mutate} /> : null}
        {activeTab === "models" ? <ModelsPanel models={models} providers={providers} mutate={mutate} /> : null}
        {activeTab === "tasks" ? <TasksPanel tasks={tasks} mutate={mutate} /> : null}
        {activeTab === "audit" ? <AuditPanel auditLogs={auditLogs} /> : null}
        {activeTab === "system" ? <SystemPanel system={system} /> : null}
      </main>
    </div>
  );
}

function Splash() {
  return (
    <div className="center-screen">
      <Loader2 className="spin" aria-hidden="true" />
      <span>正在校验后台权限...</span>
    </div>
  );
}

function LoginView({ busy, error, onLogin }: { busy: boolean; error: string; onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState("1161964493@qq.com");
  const [password, setPassword] = useState("");
  return (
    <div className="login-screen">
      <form
        className="login-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onLogin(email, password);
        }}
      >
        <ShieldCheck aria-hidden="true" />
        <h1>星幻统一后台</h1>
        <p>管理员安全登录</p>
        <label>
          账号邮箱
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button type="submit" disabled={busy}>
          {busy ? <Loader2 className="spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
          进入后台
        </button>
      </form>
    </div>
  );
}

function ForbiddenView({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="center-screen">
      <ShieldCheck aria-hidden="true" />
      <h1>需要管理员权限</h1>
      <p>{user.email}</p>
      <button type="button" onClick={onLogout}>退出登录</button>
    </div>
  );
}

function Overview({
  summary,
  providers,
  models,
  tasks,
}: {
  summary: Summary | null;
  providers: ProviderRecord[];
  models: ModelRecord[];
  tasks: TaskRecord[];
}) {
  const cards = [
    { label: "成员", value: summary?.enabledUsers ?? 0, total: summary?.users ?? 0, icon: Users },
    { label: "Provider", value: summary?.enabledProviders ?? 0, total: summary?.providers ?? 0, icon: KeyRound },
    { label: "模型", value: summary?.enabledModels ?? 0, total: summary?.models ?? 0, icon: Boxes },
    { label: "任务", value: summary?.runningTasks ?? 0, total: summary?.tasks ?? 0, icon: Activity },
    { label: "审计", value: summary?.auditLogs ?? 0, total: summary?.auditLogs ?? 0, icon: ScrollText },
  ];
  return (
    <section className="panel-stack">
      <div className="metric-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="metric-card" key={card.label}>
              <Icon aria-hidden="true" />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>总数 {card.total}</small>
            </article>
          );
        })}
      </div>
      <div className="split-grid">
        <DataTable
          title="Provider 状态"
          columns={["名称", "Base URL", "状态", "Key"]}
          rows={providers.map((item) => [item.name, item.baseUrl || "-", item.enabled ? "启用" : "停用", item.hasApiKey ? item.apiKeyPreview : "未配置"])}
        />
        <DataTable
          title="最近任务"
          columns={["任务", "状态", "模型"]}
          rows={tasks.slice(0, 6).map((item) => [item.title, statusText(item.status), item.modelId || "-"])}
        />
      </div>
      <DataTable
        title="模型目录"
        columns={["Provider", "模型", "能力", "状态"]}
        rows={models.map((item) => [item.providerId, item.displayName, item.capability, item.enabled ? "启用" : "停用"])}
      />
    </section>
  );
}

function UsersPanel({ users, mutate }: { users: AdminUser[]; mutate: (path: string, payload: Record<string, unknown>, method?: string) => void }) {
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

function ProvidersPanel({ providers, mutate }: { providers: ProviderRecord[]; mutate: (path: string, payload: Record<string, unknown>, method?: string) => void }) {
  const [form, setForm] = useState({ id: "", name: "", baseUrl: "", apiKey: "", note: "" });
  const [keys, setKeys] = useState<Record<string, string>>({});
  return (
    <section className="panel-stack">
      <FormPanel title="新增 Provider" icon={KeyRound}>
        <input placeholder="provider-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
        <input placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Base URL" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
        <input placeholder="API Key" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
        <button type="button" onClick={() => mutate("/api/admin/providers", form)}>保存 Provider</button>
      </FormPanel>
      <AdminTable title="Provider 管理">
        <thead><tr><th>ID</th><th>名称</th><th>Base URL</th><th>密钥</th><th>更新密钥</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          {providers.map((provider) => (
            <tr key={provider.id}>
              <td>{provider.id}</td>
              <td>{provider.name}</td>
              <td>{provider.baseUrl || "-"}</td>
              <td>{provider.hasApiKey ? provider.apiKeyPreview : "未配置"}</td>
              <td>
                <div className="inline-edit">
                  <input
                    placeholder="新 API Key"
                    type="password"
                    value={keys[provider.id] || ""}
                    onChange={(event) => setKeys({ ...keys, [provider.id]: event.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const apiKey = keys[provider.id];
                      if (!apiKey) return;
                      mutate(`/api/admin/providers/${provider.id}`, { apiKey }, "PATCH");
                      setKeys({ ...keys, [provider.id]: "" });
                    }}
                  >
                    保存
                  </button>
                </div>
              </td>
              <td><StatusPill tone={provider.enabled ? "success" : "muted"}>{provider.enabled ? "启用" : "停用"}</StatusPill></td>
              <td>
                <button type="button" onClick={() => mutate(`/api/admin/providers/${provider.id}`, { enabled: !provider.enabled }, "PATCH")}>
                  {provider.enabled ? "停用" : "启用"}
                </button>
                <button type="button" onClick={() => mutate(`/api/admin/providers/${provider.id}`, { clearApiKey: true }, "PATCH")}>
                  清除 Key
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </section>
  );
}

function ModelsPanel({
  models,
  providers,
  mutate,
}: {
  models: ModelRecord[];
  providers: ProviderRecord[];
  mutate: (path: string, payload: Record<string, unknown>, method?: string) => void;
}) {
  const [form, setForm] = useState({ id: "", providerId: providers[0]?.id || "grsai", modelId: "", displayName: "", capability: "image", inputProfile: "prompt", parameterSchema: "{}" });
  useEffect(() => {
    if (!form.providerId && providers[0]) setForm((value) => ({ ...value, providerId: providers[0].id }));
  }, [providers]);
  return (
    <section className="panel-stack">
      <FormPanel title="新增模型" icon={Boxes}>
        <input placeholder="model-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
        <select value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
        </select>
        <input placeholder="外部模型名" value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} />
        <input placeholder="显示名称" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <select value={form.capability} onChange={(e) => setForm({ ...form, capability: e.target.value })}>
          <option value="image">图像</option>
          <option value="video">视频</option>
          <option value="text">文本</option>
          <option value="audio">音频</option>
        </select>
        <button type="button" onClick={() => mutate("/api/admin/models", form)}>保存模型</button>
      </FormPanel>
      <AdminTable title="模型目录">
        <thead><tr><th>ID</th><th>Provider</th><th>模型</th><th>能力</th><th>输入</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          {models.map((model) => (
            <tr key={model.id}>
              <td>{model.id}</td>
              <td>{model.providerId}</td>
              <td>{model.displayName}</td>
              <td>{model.capability}</td>
              <td>{model.inputProfile}</td>
              <td><StatusPill tone={model.enabled ? "success" : "muted"}>{model.enabled ? "启用" : "停用"}</StatusPill></td>
              <td>
                <button type="button" onClick={() => mutate(`/api/admin/models/${model.id}`, { enabled: !model.enabled }, "PATCH")}>
                  {model.enabled ? "停用" : "启用"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </section>
  );
}

function TasksPanel({ tasks, mutate }: { tasks: TaskRecord[]; mutate: (path: string, payload: Record<string, unknown>, method?: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <section className="panel-stack">
      <FormPanel title="创建测试任务" icon={PlayCircle}>
        <input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={() => mutate("/api/admin/tasks", { title, status: "queued" })}>创建任务</button>
      </FormPanel>
      <AdminTable title="任务监控">
        <thead><tr><th>任务</th><th>状态</th><th>Provider</th><th>模型</th><th>日志</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td><StatusPill tone={taskTone(task.status)}>{statusText(task.status)}</StatusPill></td>
              <td>{task.providerId || "-"}</td>
              <td>{task.modelId || "-"}</td>
              <td>{task.logs?.slice(-2).join(" / ") || "-"}</td>
              <td>{new Date(task.updatedAt).toLocaleString()}</td>
              <td>
                <button type="button" onClick={() => mutate(`/api/admin/tasks/${task.id}`, { status: task.status === "cancelled" ? "queued" : "cancelled" }, "PATCH")}>
                  {task.status === "cancelled" ? "重排" : "取消"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </section>
  );
}

function AuditPanel({ auditLogs }: { auditLogs: AuditRecord[] }) {
  return (
    <DataTable
      title="审计日志"
      columns={["时间", "操作者", "动作", "对象", "说明"]}
      rows={auditLogs.map((item) => [
        new Date(item.createdAt).toLocaleString(),
        item.actorEmail,
        item.action,
        `${item.targetType}:${item.targetId}`,
        item.summary,
      ])}
    />
  );
}

function SystemPanel({ system }: { system: SystemInfo | null }) {
  const rows = useMemo(() => [
    ["环境", system?.environment || "-"],
    ["服务", system?.service || "-"],
    ["版本", system?.version || "-"],
    ["存储驱动", system?.storageDriver || "-"],
    ["数据库状态", system?.database?.status || "-"],
    ["数据库迁移", system?.database?.migrations?.join(", ") || (system?.database?.configured ? "未执行" : "未配置")],
    ["数据库错误", system?.database?.error || "-"],
    ["Redis 状态", system?.redis?.status || "-"],
    ["Redis 队列", system?.redis?.queue || "-"],
    ["Redis 深度", String(system?.redis?.depth ?? 0)],
    ["Redis 错误", system?.redis?.error || "-"],
    ["数据目录", system?.dataDir || "-"],
    ["认证数据", system?.authDbPath || "-"],
    ["后台数据", system?.adminDbPath || "-"],
    ["画布数量", String(system?.storage?.canvases ?? 0)],
    ["资源数量", String(system?.storage?.resources ?? 0)],
  ], [system]);
  return <DataTable title="系统状态" columns={["项目", "值"]} rows={rows} />;
}

function DataTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <AdminTable title={title}>
      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
      </tbody>
    </AdminTable>
  );
}

function AdminTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="data-panel">
      <header><h2>{title}</h2></header>
      <div className="table-wrap"><table>{children}</table></div>
    </section>
  );
}

function FormPanel({ title, icon: Icon, children }: { title: string; icon: typeof Plus; children: React.ReactNode }) {
  return (
    <section className="form-panel">
      <header><Icon aria-hidden="true" /><h2>{title}</h2></header>
      <div className="form-grid">{children}</div>
    </section>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "danger" | "muted" | "warning"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

async function api<T = unknown>(pathname: string, options?: RequestInit): Promise<T> {
  const response = await fetch(pathname, { ...options, credentials: "same-origin" });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload?.success === false || payload?.ok === false) {
    throw new Error(payload?.error || `${pathname} ${response.status}`);
  }
  return payload.data as T;
}

function titleFor(tab: TabId) {
  return navItems.find((item) => item.id === tab)?.label || "总览";
}

function statusText(status: TaskStatus) {
  return ({ queued: "排队", running: "运行中", succeeded: "成功", failed: "失败", cancelled: "已取消" } as Record<TaskStatus, string>)[status];
}

function taskTone(status: TaskStatus) {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "running") return "warning";
  return "muted";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
