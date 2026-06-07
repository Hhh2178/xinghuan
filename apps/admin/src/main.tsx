import {
  Activity,
  Boxes,
  Check,
  Database,
  KeyRound,
  ListChecks,
  Loader2,
  LogOut,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  ServerCog,
  Settings2,
  ShieldCheck,
  ScrollText,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { canCancelTask, canRetryTask, type TaskStatus } from "@xinghuan/shared";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./admin-api-client";
import { AdminTable, DataTable, FormPanel, StatusPill } from "./admin-common-components";
import { adminNavItems, statusText, taskTone, titleFor, type AdminTabId } from "./admin-view-model";
import "./styles.css";

type UserRole = "admin" | "member";
type Capability = "chat" | "image" | "video";
type ProviderProtocol = "openai" | "gemini" | "runninghub" | "volcengine" | "apimart" | "custom" | "grsai_draw";
type TabId = AdminTabId;

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
  protocol: ProviderProtocol;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string;
  lastProbeStatus: string;
  lastProbeMessage: string;
  lastFetchedAt: number;
  rhApps: RunningHubEntry[];
  rhWorkflows: RunningHubEntry[];
  msLoras: ModelScopeLora[];
  note: string;
  updatedAt: number;
}

interface RunningHubEntry {
  id: string;
  title: string;
  note?: string;
  thumbnail?: string;
  enabled: boolean;
  kind?: "app" | "workflow";
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
}

interface RunningHubFieldDefinition {
  nodeId: string;
  fieldName: string;
  label?: string;
  description?: string;
  fieldType?: string;
  valueType?: string;
  placeholder?: string;
  required?: boolean;
  fieldValue?: string | number | boolean;
  defaultValue?: string | number | boolean;
  options?: Array<string | number>;
}

interface ModelScopeLora {
  id: string;
  name?: string;
  targetModel: string;
  strength: number;
  enabled: boolean;
  note?: string;
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
  protocolOverride?: string;
  updatedAt: number;
}

interface FetchModelsResult {
  ok: boolean;
  status: number;
  message: string;
  modelCount: number;
  total: number;
  all: string[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
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

interface ConfirmAction {
  title: string;
  message: string;
  detail: string;
  confirmLabel: string;
  tone: "danger" | "warning";
  onConfirm: () => Promise<void>;
}

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
          {adminNavItems.map((item) => {
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
        {activeTab === "providers" ? <ApiSettingsPanel providers={providers} models={models} refresh={loadAdminData} /> : null}
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

function ApiSettingsPanel({ providers, models, refresh }: { providers: ProviderRecord[]; models: ModelRecord[]; refresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(providers[0]?.id || "");
  const selected = providers.find((provider) => provider.id === selectedId) || providers[0];
  const selectedModels = models.filter((model) => model.providerId === selected?.id);
  const [draft, setDraft] = useState(providerDraft(selected));
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("已保存，模型列表会立即同步到画布。");
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState<FetchModelsResult | null>(null);
  const [fetchMessage, setFetchMessage] = useState("点击拉取后，会在这里显示上游返回结果。");
  const [fetchTone, setFetchTone] = useState<"muted" | "loading" | "success" | "warning">("muted");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<ConfirmAction | null>(null);
  const [manualModelCapability, setManualModelCapability] = useState<Capability | null>(null);

  useEffect(() => {
    if (!selectedId && providers[0]) setSelectedId(providers[0].id);
  }, [providers, selectedId]);

  useEffect(() => {
    setDraft(providerDraft(selected));
    setApiKey("");
    setFetched(null);
    setFetchMessage("点击拉取后，会在这里显示上游返回结果。");
    setFetchTone("muted");
    setPickerOpen(false);
    setPendingConfirmAction(null);
    setManualModelCapability(null);
  }, [selected?.id]);

  async function run<T>(action: () => Promise<T>, message: string) {
    setBusy(true);
    setStatus(message);
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveProvider() {
    const payload = { ...draft, apiKey: apiKey || undefined, enabled: true };
    const saved = await run(
      () => selected ? api<ProviderRecord>(`/api/admin/providers/${selected.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(payload) }) : api<ProviderRecord>("/api/admin/providers", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
      "正在保存 Provider...",
    );
    if (saved) {
      setSelectedId(saved.id);
      setApiKey("");
      setStatus("Provider 已保存。");
    }
  }

  async function addProvider() {
    const now = Date.now();
    const created = await run(
      () => api<ProviderRecord>("/api/admin/providers", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: `custom-api-${now}`, name: "API", baseUrl: "", protocol: "openai", enabled: true }),
      }),
      "正在新增平台...",
    );
    if (created) setSelectedId(created.id);
  }

  function requestDeleteProvider() {
    if (!selected) return;
    const provider = selected;
    setPendingConfirmAction({
      title: "删除 Provider",
      message: `确认删除 ${provider.name}？`,
      detail: "该 Provider 下的模型会一并删除，画布节点将不能再选择这些模型。此操作不可自动恢复。",
      confirmLabel: "删除 Provider",
      tone: "danger",
      onConfirm: async () => {
        await run(() => api(`/api/admin/providers/${provider.id}`, { method: "DELETE" }), "正在删除 Provider...");
        setSelectedId(providers.find((item) => item.id !== provider.id)?.id || "");
      },
    });
  }

  async function probeProvider() {
    const payload = { ...draft, apiKey: apiKey || undefined };
    const result = await run(
      () => selected
        ? api<FetchModelsResult>(`/api/admin/providers/${selected.id}/probe`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) })
        : api<FetchModelsResult>("/api/admin/providers/probe", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
      "正在验证地址...",
    );
    if (result) {
      setFetched(result);
      setStatus(result.message || (result.ok ? "验证通过。" : "验证失败。"));
    }
  }

  async function fetchModels() {
    const payload = { ...draft, apiKey: apiKey || undefined };
    setBusy(true);
    setStatus("正在从上游拉取模型...");
    setFetchMessage("正在从上游拉取模型...");
    setFetchTone("loading");
    setPickerOpen(false);
    try {
      const result = selected
        ? await api<FetchModelsResult>(`/api/admin/providers/${selected.id}/fetch-models`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) })
        : await api<FetchModelsResult>("/api/admin/providers/fetch-models", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) });
      await refresh();
      setFetched(result);
      const count = result.total || result.modelCount || 0;
      setPickerOpen(Boolean(result.ok && count > 0));
      const message = result.ok && count > 0 ? `已拉取 ${count} 个模型，选择后再导入。` : result.message || "没有从上游拉取到模型。";
      setStatus(message);
      setFetchMessage(message);
      setFetchTone(result.ok && count > 0 ? "success" : "warning");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message);
      setFetchMessage(message);
      setFetchTone("warning");
    } finally {
      setBusy(false);
    }
  }

  async function updateModel(model: ModelRecord, patch: Partial<ModelRecord>) {
    await run(() => api(`/api/admin/models/${model.id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(patch) }), "正在更新模型...");
  }

  function requestDeleteModel(model: ModelRecord) {
    setPendingConfirmAction({
      title: "删除模型",
      message: `确认删除 ${model.displayName || model.modelId}？`,
      detail: "删除后，画布通用节点不会再显示该模型。已经保存的历史任务记录不会被删除。",
      confirmLabel: "删除模型",
      tone: "danger",
      onConfirm: async () => {
        await run(() => api(`/api/admin/models/${model.id}`, { method: "DELETE" }), "正在删除模型...");
      },
    });
  }

  function requestAddManualModel(capability: Capability) {
    if (!selected) return;
    setManualModelCapability(capability);
  }

  async function addManualModel(capability: Capability, modelId: string) {
    if (!selected) return;
    await run(() => api("/api/admin/models", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        id: `${selected.id}-${capability}-${modelId}`,
        providerId: selected.id,
        modelId,
        displayName: modelId,
        capability,
        enabled: true,
        inputProfile: capability === "video" ? "prompt,first_frame,last_frame" : capability === "image" ? "prompt,image_reference" : "prompt",
        parameterSchema: "{}",
      }),
    }), "正在新增模型...");
    setManualModelCapability(null);
  }

  return (
    <section className="api-settings-page">
      <div className="api-settings-head">
        <div>
          <h2>API 设置</h2>
          <p>管理平台地址、模型列表和 Key。Key 写入后端加密保存，页面不会回显完整内容。</p>
        </div>
        <span>{busy ? "处理中..." : status}</span>
      </div>

      <div className="api-settings-layout">
        <aside className="provider-rail">
          <div className="rail-title">平台列表</div>
          <div className="provider-list">
            {providers.map((provider) => (
              <button key={provider.id} type="button" className={provider.id === selected?.id ? "provider-item active" : "provider-item"} onClick={() => setSelectedId(provider.id)}>
                <span className="provider-grip">::</span>
                <span className="provider-key"><KeyRound aria-hidden="true" /></span>
                <span className="provider-copy">
                  <strong>{provider.name}</strong>
                  <small>{provider.baseUrl || "未配置地址"}</small>
                </span>
                <em>{provider.protocol || "openai"}</em>
              </button>
            ))}
          </div>
          <button className="provider-add" type="button" onClick={addProvider}><Plus aria-hidden="true" /> 新增平台</button>
          <button className="provider-recommend" type="button"><ListChecks aria-hidden="true" /> 推荐API</button>
        </aside>

        <div className="provider-editor">
          <section className="api-card editor-banner">
            <div>
              <h3>{draft.name || "API"}</h3>
              <p>配置基础信息、API Key 和可用模型</p>
            </div>
            <div className="editor-actions">
              <button className="ghost-action danger-action" type="button" onClick={requestDeleteProvider} disabled={!selected}><Trash2 aria-hidden="true" /> 删除</button>
              <button className="primary-action" type="button" onClick={saveProvider}><Save aria-hidden="true" /> 保存</button>
            </div>
          </section>

          <section className="api-card">
            <BlockTitle title="基本信息" sub="平台显示名、唯一 ID 和请求地址" />
            <label>平台名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <div className="field-note">平台 ID: <code>{draft.id || selected?.id || "custom-api"}</code></div>
            <label>请求地址<input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.example.com" /></label>
            <label>API Key</label>
            <div className="key-row">
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={selected?.hasApiKey ? `保持当前 Key ${selected.apiKeyPreview}` : "请输入 sk-..."} />
              <button type="button" className="icon-soft" onClick={saveProvider} title="保存 Key"><Check aria-hidden="true" /></button>
              <button type="button" className="icon-soft" onClick={() => setApiKey("")} title="清空输入"><Trash2 aria-hidden="true" /></button>
            </div>
            <div className="field-note">当前 Key 已保存: {selected?.hasApiKey ? selected.apiKeyPreview : "未配置"}</div>
            <div className="inline-actions">
              <button type="button" onClick={probeProvider}><RefreshCw aria-hidden="true" /> 验证地址</button>
              <button type="button" onClick={probeProvider}><RefreshCw aria-hidden="true" /> 验证协议</button>
              <select value={draft.protocol} onChange={(event) => setDraft({ ...draft, protocol: event.target.value as ProviderProtocol })}>
                <option value="openai">OpenAI 直连</option>
                <option value="gemini">Gemini</option>
                <option value="runninghub">RunningHub</option>
                <option value="volcengine">火山方舟</option>
                <option value="apimart">APIMart</option>
                <option value="grsai_draw">GRSAI Draw</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            {selected?.lastProbeMessage ? <div className="probe-note">{selected.lastProbeStatus === "ok" ? "通过" : "失败"}: {selected.lastProbeMessage}</div> : null}
          </section>

          {isRunningHubProvider(draft) ? (
            <RunningHubPanel
              apps={draft.rhApps}
              workflows={draft.rhWorkflows}
              onChange={(patch) => setDraft({ ...draft, ...patch })}
            />
          ) : null}

          {isModelScopeProvider(draft) ? (
            <ModelScopeLoraPanel
              loras={draft.msLoras}
              imageModels={selectedModels.filter((model) => model.capability === "image").map((model) => model.modelId)}
              onChange={(msLoras) => setDraft({ ...draft, msLoras })}
            />
          ) : null}

          <section className="api-card model-fetch-card">
            <div>
              <h3>模型列表</h3>
              <p>从上游 API 自动拉取所有可用模型并按类型分类（image / chat / video）</p>
              <p className={`model-fetch-feedback ${fetchTone}`}>{fetchMessage}</p>
            </div>
            <div className="editor-actions">
              <button className="primary-action" type="button" onClick={fetchModels} disabled={busy}>
                {fetchTone === "loading" ? <Loader2 className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                {fetchTone === "loading" ? "拉取中" : "拉取模型"}
              </button>
              <button className="ghost-action" type="button" onClick={() => setPickerOpen(true)} disabled={busy || !fetched?.all?.length}><ListChecks aria-hidden="true" /> 选择模型</button>
            </div>
          </section>

          {(["image", "chat", "video"] as Capability[]).map((capability) => (
            <ModelSection
              key={capability}
              capability={capability}
              models={selectedModels.filter((model) => model.capability === capability)}
              onAdd={() => requestAddManualModel(capability)}
              onUpdate={updateModel}
              onDelete={requestDeleteModel}
            />
          ))}
        </div>
      </div>

      {pickerOpen && fetched && selected ? (
        <ModelPicker
          fetched={fetched}
          existing={selectedModels}
          providerId={selected.id}
          onClose={() => setPickerOpen(false)}
          onImport={async (items) => {
            await run(() => api(`/api/admin/providers/${selected.id}/import-models`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ models: items }) }), "正在导入模型...");
            setPickerOpen(false);
          }}
        />
      ) : null}

      {pendingConfirmAction ? (
        <ConfirmActionDialog
          action={pendingConfirmAction}
          busy={busy}
          onCancel={() => setPendingConfirmAction(null)}
          onConfirm={async () => {
            await pendingConfirmAction.onConfirm();
            setPendingConfirmAction(null);
          }}
        />
      ) : null}

      {manualModelCapability && selected ? (
        <ManualModelDialog
          capability={manualModelCapability}
          providerName={selected.name}
          busy={busy}
          onCancel={() => setManualModelCapability(null)}
          onSubmit={(modelId) => addManualModel(manualModelCapability, modelId)}
        />
      ) : null}
    </section>
  );
}

function ConfirmActionDialog({
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
      <section className={`admin-confirm-dialog ${action.tone}`}>
        <header>
          <div className="confirm-icon"><Trash2 aria-hidden="true" /></div>
          <div>
            <h3 id="confirm-action-title">{action.title}</h3>
            <p>{action.message}</p>
          </div>
        </header>
        <p className="confirm-detail">{action.detail}</p>
        <footer>
          <button type="button" className="ghost-action" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="danger-action solid" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {action.confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ManualModelDialog({
  capability,
  providerName,
  busy,
  onCancel,
  onSubmit,
}: {
  capability: Capability;
  providerName: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (modelId: string) => Promise<void>;
}) {
  const [modelId, setModelId] = useState("");
  const trimmedModelId = modelId.trim();
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="manual-model-title">
      <form
        className="manual-model-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmedModelId) void onSubmit(trimmedModelId);
        }}
      >
        <header>
          <h3 id="manual-model-title">新增{capabilityLabel(capability)}模型</h3>
          <p>{providerName} · 手动登记模型 ID 后，画布会从模型目录读取。</p>
        </header>
        <label>
          模型 ID
          <input
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder={capability === "image" ? "gpt-image-2" : capability === "video" ? "grok-video" : "gpt-5.5"}
            autoFocus
          />
        </label>
        <p className="field-note">默认会按当前能力分类创建，并生成可继续编辑的参数 Schema。</p>
        <footer>
          <button type="button" className="ghost-action" onClick={onCancel} disabled={busy}>取消</button>
          <button type="submit" className="primary-action" disabled={busy || !trimmedModelId}>
            {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            创建模型
          </button>
        </footer>
      </form>
    </div>
  );
}

function BlockTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="block-title">
      <h3>{title}</h3>
      <p>{sub}</p>
    </div>
  );
}

function RunningHubPanel({
  apps,
  workflows,
  onChange,
}: {
  apps: RunningHubEntry[];
  workflows: RunningHubEntry[];
  onChange: (patch: { rhApps?: RunningHubEntry[]; rhWorkflows?: RunningHubEntry[] }) => void;
}) {
  const [paste, setPaste] = useState("");
  function addFromPaste() {
    const parsed = parseRunningHubRef(paste);
    if (!parsed) return;
    const entry: RunningHubEntry = {
      id: parsed.id,
      kind: parsed.type,
      appId: parsed.type === "app" ? parsed.id : undefined,
      workflowId: parsed.type === "workflow" ? parsed.id : undefined,
      runTargetId: parsed.id,
      title: parsed.type === "app" ? `AI 应用 ${parsed.id.slice(-6)}` : `工作流 ${parsed.id.slice(-6)}`,
      note: "",
      enabled: true,
    };
    if (parsed.type === "app") {
      if (!apps.some((item) => item.id === parsed.id)) onChange({ rhApps: [entry, ...apps] });
    } else if (!workflows.some((item) => item.id === parsed.id)) onChange({ rhWorkflows: [entry, ...workflows] });
    setPaste("");
  }
  return (
    <section className="api-card rh-panel">
      <BlockTitle title="RunningHub 应用与工作流" sub="粘贴 /run/ai-app/... 或 /run/workflow/... 创建可在节点中调用的卡片" />
      <div className="rh-paste-row">
        <input value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="https://www.runninghub.cn/run/workflow/..." />
        <button type="button" className="primary-action" onClick={addFromPaste}>创建卡片</button>
      </div>
      <RhEntryList title="AI 应用" kind="app" entries={apps} onChange={(next) => onChange({ rhApps: next })} />
      <RhEntryList title="工作流" kind="workflow" entries={workflows} onChange={(next) => onChange({ rhWorkflows: next })} />
    </section>
  );
}

function RhEntryList({ title, kind, entries, onChange }: { title: string; kind: "app" | "workflow"; entries: RunningHubEntry[]; onChange: (entries: RunningHubEntry[]) => void }) {
  function update(index: number, patch: Partial<RunningHubEntry>) {
    onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)));
  }
  return (
    <div className="rh-entry-block">
      <div className="rh-entry-title">{title}<span>{entries.length}</span></div>
      {entries.length ? entries.map((entry, index) => (
        kind === "workflow" ? (
          <RhWorkflowEntryEditor
            key={`${kind}-${entry.id}-${index}`}
            entry={entry}
            onUpdate={(patch) => update(index, patch)}
            onDelete={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
          />
        ) : (
          <div className="rh-entry-row" key={`${kind}-${entry.id}-${index}`}>
            <div className="rh-entry-id">{kind === "app" ? `/run/ai-app/${entry.appId || entry.id}` : `/run/workflow/${entry.workflowId || entry.id}`}</div>
            <input value={entry.title} onChange={(event) => update(index, { title: event.target.value })} />
            <input value={entry.note || ""} onChange={(event) => update(index, { note: event.target.value })} placeholder="备注" />
            <button type="button" className="icon-soft" onClick={() => update(index, { enabled: !entry.enabled })}>{entry.enabled ? "启用" : "停用"}</button>
            <button type="button" className="icon-soft" onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}><Trash2 aria-hidden="true" /></button>
          </div>
        )
      )) : <div className="empty-models">暂无{title}</div>}
    </div>
  );
}

function RhWorkflowEntryEditor({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: RunningHubEntry;
  onUpdate: (patch: Partial<RunningHubEntry>) => void;
  onDelete: () => void;
}) {
  const [workflowJsonText, setWorkflowJsonText] = useState(entry.workflowJson || "");
  const [fieldsText, setFieldsText] = useState(stringifyRunningHubFields(entry.fields));
  const [workflowJsonError, setWorkflowJsonError] = useState("");
  const [fieldsError, setFieldsError] = useState("");

  useEffect(() => {
    setWorkflowJsonText(entry.workflowJson || "");
    setFieldsText(stringifyRunningHubFields(entry.fields));
    setWorkflowJsonError("");
    setFieldsError("");
  }, [entry.workflowJson, entry.fields]);

  function applyWorkflowJson() {
    const text = workflowJsonText.trim();
    if (!text) {
      onUpdate({ workflowJson: "" });
      setWorkflowJsonError("");
      return;
    }
    try {
      JSON.parse(text);
      onUpdate({ workflowJson: text });
      setWorkflowJsonError("");
    } catch {
      setWorkflowJsonError("工作流 JSON 不是合法 JSON");
    }
  }

  function applyFields() {
    const text = fieldsText.trim();
    if (!text) {
      onUpdate({ fields: [] });
      setFieldsError("");
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("字段映射必须是数组");
      onUpdate({ fields: parsed as RunningHubFieldDefinition[] });
      setFieldsError("");
    } catch (error) {
      setFieldsError(error instanceof Error ? error.message : "字段映射 JSON 无效");
    }
  }

  return (
    <div className="rh-entry-block">
      <div className="rh-entry-row">
        <div className="rh-entry-id">{`/run/workflow/${entry.workflowId || entry.id}`}</div>
        <input value={entry.title} onChange={(event) => onUpdate({ title: event.target.value })} />
        <input value={entry.note || ""} onChange={(event) => onUpdate({ note: event.target.value })} placeholder="备注" />
        <button type="button" className="icon-soft" onClick={() => onUpdate({ enabled: !entry.enabled })}>{entry.enabled ? "启用" : "停用"}</button>
        <button type="button" className="icon-soft" onClick={onDelete}><Trash2 aria-hidden="true" /></button>
      </div>
      <div className="field-note">运行目标 ID：画布节点选中该工作流后，会默认注入到 `webappId`。</div>
      <input value={entry.runTargetId || entry.workflowId || entry.id} onChange={(event) => onUpdate({ runTargetId: event.target.value })} placeholder="运行目标 ID" />
      <label>工作流 JSON</label>
      <textarea
        value={workflowJsonText}
        onChange={(event) => setWorkflowJsonText(event.target.value)}
        onBlur={applyWorkflowJson}
        placeholder='{"nodes":[],"links":[]}'
        rows={6}
      />
      {workflowJsonError ? <div className="probe-note">失败: {workflowJsonError}</div> : null}
      <label>字段映射 JSON</label>
      <textarea
        value={fieldsText}
        onChange={(event) => setFieldsText(event.target.value)}
        onBlur={applyFields}
        placeholder={`[
  {
    "nodeId": "12",
    "fieldName": "prompt",
    "fieldType": "TEXT",
    "description": "正向提示词",
    "fieldValue": ""
  }
]`}
        rows={10}
      />
      {fieldsError ? <div className="probe-note">失败: {fieldsError}</div> : null}
    </div>
  );
}

function ModelScopeLoraPanel({
  loras,
  imageModels,
  onChange,
}: {
  loras: ModelScopeLora[];
  imageModels: string[];
  onChange: (loras: ModelScopeLora[]) => void;
}) {
  const modelOptions = imageModels.length ? imageModels : ["Tongyi-MAI/Z-Image-Turbo", "Qwen/Qwen-Image-2512"];
  function update(index: number, patch: Partial<ModelScopeLora>) {
    onChange(loras.map((lora, loraIndex) => (loraIndex === index ? { ...lora, ...patch } : lora)));
  }
  return (
    <section className="api-card lora-panel">
      <div className="model-section-head">
        <BlockTitle title="ModelScope LoRA" sub="为当前外部模型绑定 LoRA，供图像节点按模型自动选择" />
        <button type="button" className="ghost-action" onClick={() => onChange([{ id: "", name: "", targetModel: modelOptions[0], strength: 0.8, enabled: true }, ...loras])}><Plus aria-hidden="true" /> LoRA</button>
      </div>
      <div className="lora-list">
        {loras.length ? loras.map((lora, index) => (
          <div className="lora-row" key={`${lora.id}-${index}`}>
            <input value={lora.id} onChange={(event) => update(index, { id: event.target.value })} placeholder="LoRA ID，例如 user/style" />
            <select value={lora.targetModel} onChange={(event) => update(index, { targetModel: event.target.value })}>
              {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            <input type="number" min="0" max="2" step="0.05" value={lora.strength} onChange={(event) => update(index, { strength: Number(event.target.value) })} />
            <button type="button" className="icon-soft" onClick={() => update(index, { enabled: !lora.enabled })}>{lora.enabled ? "启用" : "停用"}</button>
            <button type="button" className="icon-soft" onClick={() => onChange(loras.filter((_, loraIndex) => loraIndex !== index))}><Trash2 aria-hidden="true" /></button>
          </div>
        )) : <div className="empty-models">暂无 LoRA</div>}
      </div>
    </section>
  );
}

function ModelSection({
  capability,
  models,
  onAdd,
  onUpdate,
  onDelete,
}: {
  capability: Capability;
  models: ModelRecord[];
  onAdd: () => void;
  onUpdate: (model: ModelRecord, patch: Partial<ModelRecord>) => Promise<void>;
  onDelete: (model: ModelRecord) => void;
}) {
  return (
    <section className="api-card model-section">
      <div className="model-section-head">
        <div>
          <h3>{capabilityLabel(capability)}模型</h3>
          <p>{capabilityHelp(capability)}</p>
        </div>
        <button type="button" className="ghost-action" onClick={onAdd}><Plus aria-hidden="true" /> 模型</button>
      </div>
      <div className="model-list">
        {models.length ? models.map((model) => (
          <ModelEditorRow key={model.id} model={model} onUpdate={onUpdate} onDelete={onDelete} />
        )) : <div className="empty-models">暂无模型</div>}
      </div>
    </section>
  );
}

function ModelEditorRow({
  model,
  onUpdate,
  onDelete,
}: {
  model: ModelRecord;
  onUpdate: (model: ModelRecord, patch: Partial<ModelRecord>) => Promise<void>;
  onDelete: (model: ModelRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(model);
  const [schemaError, setSchemaError] = useState("");

  useEffect(() => {
    setDraft(model);
    setSchemaError("");
  }, [model.id, model.updatedAt]);

  async function saveModel() {
    let parameterSchema = draft.parameterSchema.trim() || "{}";
    try {
      parameterSchema = JSON.stringify(JSON.parse(parameterSchema), null, 2);
    } catch {
      setSchemaError("参数 schema 必须是有效 JSON。");
      return;
    }
    setSchemaError("");
    await onUpdate(model, {
      displayName: draft.displayName.trim() || draft.modelId.trim(),
      modelId: draft.modelId.trim(),
      capability: draft.capability,
      protocolOverride: draft.protocolOverride || "",
      inputProfile: draft.inputProfile.trim() || "prompt",
      parameterSchema,
    });
  }

  const capabilityTips = modelCapabilityTips(draft.capability);
  const schemaExample = modelSchemaExample(draft.capability);

  return (
    <div className={expanded ? "model-row-wrap expanded" : "model-row-wrap"}>
      <div className="model-row">
        <button type="button" className="model-identity" onClick={() => setExpanded((value) => !value)}>
          <strong>{model.displayName}</strong>
          <span>{model.modelId}</span>
        </button>
        <select value={model.protocolOverride || ""} onChange={(event) => onUpdate(model, { protocolOverride: event.target.value })} aria-label={`${model.displayName} 协议`}>
          <option value="">默认协议</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="volcengine">火山</option>
          <option value="runninghub">RH</option>
          <option value="apimart">APIMart</option>
          <option value="grsai_draw">GRSAI Draw</option>
          <option value="custom">自定义</option>
        </select>
        <button type="button" className="icon-soft" onClick={() => onUpdate(model, { enabled: !model.enabled })}>{model.enabled ? "启用" : "停用"}</button>
        <button type="button" className="icon-soft" onClick={() => setExpanded((value) => !value)} title="模型高级设置"><Settings2 aria-hidden="true" /></button>
        <button type="button" className="icon-soft" onClick={() => onDelete(model)} title="删除"><Trash2 aria-hidden="true" /></button>
      </div>
      {expanded ? (
        <div className="model-advanced">
          <section className="schema-guide-card">
            <div className="schema-guide-grid">
              <div>
                <strong>协议来源</strong>
                <p>Provider 或协议覆盖决定实际调用哪个上游协议，例如 OpenAI、Gemini、GRSAI Draw。</p>
              </div>
              <div>
                <strong>节点参数来源</strong>
                <p>通用节点右侧看到的动态参数，直接来自当前模型的参数 Schema，而不是写死在前端里。</p>
              </div>
              <div>
                <strong>输入口来源</strong>
                <p><code>inputProfile</code> 决定节点暴露哪些输入口，例如仅文本提示词，或提示词加参考图。</p>
              </div>
            </div>
            <div className="schema-guide-note">
              <strong>inputProfile 示例</strong>
              <span><code>prompt</code> 表示只有文本提示词，<code>prompt,image_reference</code> 表示额外暴露参考图输入。</span>
            </div>
          </section>
          <div className="model-fields">
            <label>显示名称<input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
            <label>模型 ID<input value={draft.modelId} onChange={(event) => setDraft({ ...draft, modelId: event.target.value })} /></label>
            <label>能力分类
              <select value={draft.capability} onChange={(event) => setDraft({ ...draft, capability: event.target.value as Capability })}>
                <option value="image">图像</option>
                <option value="chat">语言</option>
                <option value="video">视频</option>
              </select>
            </label>
            <label>输入 Profile<input value={draft.inputProfile} onChange={(event) => setDraft({ ...draft, inputProfile: event.target.value })} placeholder="prompt,image_reference" /></label>
          </div>
          <section className="schema-guide-card compact">
            <div className="schema-guide-head">
              <strong>{capabilityLabel(draft.capability)}节点建议参数</strong>
              <span>下面这些字段会直接影响前端节点展示和任务 payload。</span>
            </div>
            <ul className="schema-bullet-list">
              {capabilityTips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
            <pre className="schema-example-block">{schemaExample}</pre>
          </section>
          <label>参数 Schema（JSON）
            <textarea value={draft.parameterSchema} onChange={(event) => setDraft({ ...draft, parameterSchema: event.target.value })} spellCheck={false} />
          </label>
          <div className="model-advanced-footer">
            <span className={schemaError ? "schema-note error" : "schema-note"}>{schemaError || "保存后，模型分类、输入能力和动态参数会立即同步到画布通用节点。"}</span>
            <button type="button" className="primary-action" onClick={saveModel}><Save aria-hidden="true" /> 保存模型设置</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModelPicker({
  fetched,
  existing,
  providerId,
  onClose,
  onImport,
}: {
  fetched: FetchModelsResult;
  existing: ModelRecord[];
  providerId: string;
  onClose: () => void;
  onImport: (items: Array<{ modelId: string; capability: Capability; displayName: string }>) => Promise<void>;
}) {
  const existingMap = useMemo(() => new Map(existing.map((model) => [model.modelId, model.capability])), [existing]);
  const initial = useMemo(() => {
    const ids = new Set(fetched.all || []);
    const category: Record<string, Capability> = {};
    const selected: Record<string, boolean> = {};
    for (const id of ids) {
      const existingCapability = existingMap.get(id);
      const capability = existingCapability
        || ((fetched.imageModels || []).includes(id) ? "image" : (fetched.videoModels || []).includes(id) ? "video" : "chat");
      category[id] = capability;
      selected[id] = Boolean(existingCapability);
    }
    return { category, selected };
  }, [existing, existingMap, fetched]);
  const [category, setCategory] = useState(initial.category);
  const [selected, setSelected] = useState(initial.selected);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Capability | "all">("all");
  const ids = Object.keys(category).sort();
  const visible = ids.filter((id) => (!filter || id.toLowerCase().includes(filter.toLowerCase())) && (tab === "all" || category[id] === tab));
  const selectedCount = ids.filter((id) => selected[id]).length;

  const importItems = ids
    .filter((id) => selected[id])
    .map((id) => ({ modelId: id, displayName: id, capability: category[id] || "chat" }));

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true">
      <section className="model-picker">
        <header>
          <div>
            <h3>选择模型</h3>
            <p>{providerId} · 共 {ids.length} 个模型 · 已选 {selectedCount} 个</p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <div className="picker-toolbar">
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索模型" />
          {(["all", "image", "chat", "video"] as Array<Capability | "all">).map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {item === "all" ? "全部" : capabilityLabel(item)} {ids.filter((id) => item === "all" || category[id] === item).length}
            </button>
          ))}
        </div>
        <div className="picker-list">
          {visible.map((id) => (
            <div className={selected[id] ? "picker-row selected" : "picker-row"} key={id}>
              <label>
                <input type="checkbox" checked={Boolean(selected[id])} onChange={(event) => setSelected({ ...selected, [id]: event.target.checked })} />
                <span>{id}</span>
              </label>
              <select value={category[id]} onChange={(event) => setCategory({ ...category, [id]: event.target.value as Capability })}>
                <option value="image">图像</option>
                <option value="chat">语言</option>
                <option value="video">视频</option>
              </select>
            </div>
          ))}
        </div>
        <footer>
          <span>生图 {importItems.filter((item) => item.capability === "image").length}</span>
          <span>LLM {importItems.filter((item) => item.capability === "chat").length}</span>
          <span>视频 {importItems.filter((item) => item.capability === "video").length}</span>
          <button type="button" className="primary-action" onClick={() => onImport(importItems)}>导入选中模型</button>
        </footer>
      </section>
    </div>
  );
}

const jsonHeaders = { "content-type": "application/json" };

function providerDraft(provider?: ProviderRecord) {
  return {
    id: provider?.id || "",
    name: provider?.name || "",
    baseUrl: provider?.baseUrl || "",
    protocol: (provider?.protocol || "openai") as ProviderProtocol,
    rhApps: provider?.rhApps || [],
    rhWorkflows: provider?.rhWorkflows || [],
    msLoras: provider?.msLoras || [],
    note: provider?.note || "",
  };
}

function isRunningHubProvider(provider: ReturnType<typeof providerDraft>) {
  return provider.id === "runninghub" || provider.protocol === "runninghub";
}

function isModelScopeProvider(provider: ReturnType<typeof providerDraft>) {
  return provider.id === "modelscope" || /modelscope/i.test(provider.name) || /modelscope/i.test(provider.baseUrl);
}

function parseRunningHubRef(value: string) {
  const text = value.trim();
  const match = text.match(/\/run\/(ai-app|workflow)\/([0-9A-Za-z_-]+)/i);
  if (match) return { type: match[1].toLowerCase() === "ai-app" ? "app" as const : "workflow" as const, id: match[2] };
  const plain = text.match(/^[0-9A-Za-z_-]{6,}$/);
  return plain ? { type: "workflow" as const, id: text } : null;
}

function stringifyRunningHubFields(fields: RunningHubFieldDefinition[] | undefined) {
  return fields?.length ? JSON.stringify(fields, null, 2) : "";
}

function capabilityLabel(capability: Capability) {
  return capability === "image" ? "生图" : capability === "video" ? "视频" : "聊天";
}

function capabilityHelp(capability: Capability) {
  if (capability === "image") return "在线生图和无限画布 API 生成使用。";
  if (capability === "video") return "无限画布视频生成节点使用。";
  return "GPT 对话和 LLM 节点使用。";
}

function modelCapabilityTips(capability: Capability) {
  if (capability === "image") {
    return [
      "推荐把 aspectRatio 作为主控项，节点会按比例自动匹配适合的尺寸档位。",
      "只有当 size 代表质量档位或独立分辨率套餐时，再把 size 暴露给前端选择。",
      "如模型支持垫图或角色参考，可在 schema 中增加 referenceImages、imageCount、seed 等字段。",
    ];
  }
  if (capability === "video") {
    return [
      "视频节点常见参数是 aspectRatio、duration、resolution、fps，尽量与上游真实能力保持一致。",
      "如果不同 provider 的时长或清晰度档位不同，应在各自模型 schema 内单独声明，不要写死在前端。",
      "参考图、首尾帧或镜头控制类输入，优先通过 inputProfile 和 schema 联合表达。",
    ];
  }
  return [
    "聊天节点通常保留 temperature、maxTokens、topP 等推理参数，字段名尽量与上游协议一致。",
    "如果模型支持 systemPrompt、reasoningEffort 或 tools 开关，也应通过 schema 显式暴露。",
    "inputProfile 一般保持 prompt；只有确实需要额外输入口时再扩展。",
  ];
}

function modelSchemaExample(capability: Capability) {
  if (capability === "image") {
    return `{
  "aspectRatio": {
    "type": "enum",
    "label": "画幅比例",
    "options": ["1:1", "3:4", "4:3", "9:16", "16:9"],
    "default": "1:1"
  },
  "size": {
    "type": "enum",
    "label": "尺寸档位",
    "options": ["1024x1024", "1024x1536", "1536x1024"]
  },
  "referenceImages": {
    "type": "number",
    "label": "参考图张数",
    "min": 0,
    "max": 4,
    "default": 0
  }
}`;
  }
  if (capability === "video") {
    return `{
  "aspectRatio": {
    "type": "enum",
    "label": "画幅比例",
    "options": ["16:9", "9:16", "1:1"],
    "default": "16:9"
  },
  "duration": {
    "type": "enum",
    "label": "时长",
    "options": ["5", "10"],
    "default": "5"
  },
  "resolution": {
    "type": "enum",
    "label": "清晰度",
    "options": ["720p", "1080p"],
    "default": "720p"
  }
}`;
  }
  return `{
  "temperature": {
    "type": "number",
    "label": "采样温度",
    "min": 0,
    "max": 2,
    "step": 0.1,
    "default": 0.7
  },
  "maxTokens": {
    "type": "number",
    "label": "最大输出",
    "min": 256,
    "max": 8192,
    "step": 256,
    "default": 2048
  }
}`;
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
                {canCancelTask(task.status) ? (
                  <button type="button" onClick={() => mutate(`/api/admin/tasks/${task.id}`, { action: "cancel" }, "PATCH")}>
                    取消
                  </button>
                ) : canRetryTask(task.status) ? (
                  <button type="button" onClick={() => mutate(`/api/admin/tasks/${task.id}/retry`, {}, "POST")}>
                    重试
                  </button>
                ) : (
                  <span>-</span>
                )}
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
