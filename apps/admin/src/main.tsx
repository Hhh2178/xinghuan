import { Bot, KeyRound, Loader2, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { type TaskStatus } from "@xinghuan/shared";
import { AdminApiError, api } from "./admin-api-client";
import { ApiSettingsPanel } from "./admin-api-settings-panel";
import { AdminAssistantPanel } from "./admin-assistant-panel";
import { AdminAssistantSettingsPanel } from "./admin-assistant-settings-panel";
import { ConfirmActionDialog } from "./admin-confirm-action-dialog";
import { Overview } from "./admin-overview-panel";
import { ManualModelDialog } from "./admin-manual-model-dialog";
import { AuditPanel, SystemPanel } from "./admin-readonly-panels";
import { TasksPanel } from "./admin-task-panel";
import type {
  AdminUser as AdminUserShape,
  AdminSessionRecord as AdminSessionRecordShape,
  AuditRecord as AuditRecordShape,
  AuthUser as AuthUserShape,
  Capability as CapabilityShape,
  ConfirmAction as ConfirmActionShape,
  ModelRecord as ModelRecordShape,
  ModelScopeLora,
  ProviderProtocol,
  ProviderRecord as ProviderRecordShape,
  RunningHubEntry,
  AssistantSettings as AssistantSettingsShape,
  Summary as SummaryShape,
  SystemInfo as SystemInfoShape,
  TabId,
  TaskRecord as TaskRecordShape,
} from "./admin-types";
import { UsersPanel } from "./admin-users-panel";
import { adminNavItems, titleFor } from "./admin-view-model";
import "./styles.css";

void ConfirmActionDialog;
void ManualModelDialog;

const ADMIN_ASSISTANT_STORAGE_KEY = "xinghuan.adminAssistant.open";
const DEFAULT_ASSISTANT_MODEL = "Agnes-2.0-Flash";

export type Capability = CapabilityShape;
export type ConfirmAction = ConfirmActionShape;

export interface AuthUser extends AuthUserShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

export interface AdminUser extends AuthUser {
  disabled: boolean;
  passwordAvailable: boolean;
  password: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminSessionRecord extends AdminSessionRecordShape {}

export interface ProviderRecord {
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

export interface ModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: Capability;
  enabled: boolean;
  inputProfile: string;
  inputCapabilities?: {
    prompt?: boolean;
    imageReference?: boolean;
    multiImage?: boolean;
    firstFrame?: boolean;
    lastFrame?: boolean;
    mask?: boolean;
    audioReference?: boolean;
  };
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
  updatedAt: number;
}

export interface Summary {
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
  storage: {
    canvases: number;
    resources: number;
    inputFiles: number;
    outputFiles: number;
  };
}

export interface TaskRecord {
  id: string;
  title: string;
  status: TaskStatus;
  providerId?: string;
  modelId?: string;
  logs: string[];
  updatedAt: number;
}

export interface AssistantSettings extends AssistantSettingsShape {}

type AuditRecord = AuditRecordShape;
type SystemInfo = SystemInfoShape;

function defaultAssistantSettings(): AssistantSettings {
  return {
    frontend: {
      enabled: true,
      title: "画布 AI 助手",
      hint: "",
      placeholder: "输入问题或要求",
      allowWorkflowAttachment: true,
      allowNodeAttachment: true,
      allowMediaAttachment: true,
      persistMemory: false,
    },
    backend: {
      enabled: true,
      title: "后台 AI 助手",
      hint: "",
      placeholder: "输入问题或要求",
      defaultOpen: true,
      allowProviderContext: true,
      allowModelContext: true,
      allowTaskContext: true,
      allowUserContext: true,
      allowAuditContext: true,
    },
    integration: {
      kernel: "hermes",
      endpoint: "已配置（服务器内地址已隐藏）",
      endpointConfigured: true,
      workspace: "gray",
      model: DEFAULT_ASSISTANT_MODEL,
      profile: "canvas-assistant",
      persistMemory: false,
      strictMode: true,
    },
    updatedAt: Date.now(),
    revision: 1,
  };
}

function AdminApp() {
  const [authStatus, setAuthStatus] = useState<"checking" | "ready">("checking");
  const [currentUser, setCurrentUser] = useState<AuthUserShape | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [assistantOpen, setAssistantOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(ADMIN_ASSISTANT_STORAGE_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
    return true;
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>(defaultAssistantSettings());
  const [users, setUsers] = useState<AdminUserShape[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRecordShape[]>([]);
  const [providers, setProviders] = useState<ProviderRecordShape[]>([]);
  const [models, setModels] = useState<ModelRecordShape[]>([]);
  const [tasks, setTasks] = useState<TaskRecordShape[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ authenticated: boolean; user: AuthUserShape | null }>("/api/auth/admin-me")
      .then((data) => setCurrentUser(data.authenticated ? data.user : null))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthStatus("ready"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_ASSISTANT_STORAGE_KEY, assistantOpen ? "1" : "0");
  }, [assistantOpen]);

  const isAdmin = currentUser?.role === "admin";

  async function loadAdminData() {
    if (!isAdmin) return;
    setBusy(true);
    setError("");
    try {
      const [
        nextSummary,
        nextAssistantSettings,
        nextUsers,
        nextSessions,
        nextProviders,
        nextModels,
        nextTasks,
        nextAuditLogs,
        nextSystem,
      ] = await Promise.all([
        api<Summary>("/api/admin/summary"),
        api<AssistantSettings>("/api/admin/assistant/settings"),
        api<AdminUserShape[]>("/api/admin/users"),
        api<AdminSessionRecordShape[]>("/api/admin/sessions"),
        api<ProviderRecordShape[]>("/api/admin/providers"),
        api<ModelRecordShape[]>("/api/admin/models"),
        api<TaskRecordShape[]>("/api/admin/tasks"),
        api<AuditRecord[]>("/api/admin/audit"),
        api<SystemInfo>("/api/admin/system"),
      ]);
      setSummary(nextSummary);
      setAssistantSettings(nextAssistantSettings);
      setUsers(nextUsers);
      setSessions(nextSessions);
      setProviders(nextProviders);
      setModels(nextModels);
      setTasks(nextTasks);
      setAuditLogs(nextAuditLogs);
      setSystem(nextSystem);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, [isAdmin]);

  useEffect(() => {
    setAssistantOpen(assistantSettings.backend.defaultOpen);
  }, [assistantSettings.backend.defaultOpen]);

  async function handleLogin(email: string, password: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ authenticated: boolean; user: AuthUserShape }>(
        "/api/auth/admin-login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      setCurrentUser(data.user);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "";
      setError(message === "ADMIN_REQUIRED" ? "该账号没有后台管理员权限。" : "登录失败，请检查账号和密码。");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentUser(null);
  }

  async function mutate(
    path: string,
    payload: Record<string, unknown>,
    method = "POST",
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "checking") return <Splash />;
  if (!currentUser) {
    return <LoginView busy={busy} error={error} onLogin={handleLogin} />;
  }
  if (!isAdmin) {
    return <ForbiddenView user={currentUser} onLogout={handleLogout} />;
  }

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

      <div className={`admin-workspace${assistantOpen ? " admin-workspace--with-assistant" : ""}`}>
        <main className={`admin-main${activeTab === "providers" || activeTab === "assistant" ? " admin-main--fixed-panel" : ""}${activeTab === "assistant" ? " admin-main--assistant-settings" : ""}`}>
          <header className="admin-topbar">
            <div>
              <p>统一后台</p>
              <h1>{titleFor(activeTab)}</h1>
            </div>
            <div className="topbar-actions">
              {busy ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <span className="health-dot">API 已连接</span>
              )}
              {assistantSettings.backend.enabled ? (
                <button
                  type="button"
                  className={assistantOpen ? "icon-button admin-assistant-topbar-toggle active" : "icon-button admin-assistant-topbar-toggle"}
                  onClick={() => setAssistantOpen((current) => !current)}
                  title={assistantOpen ? "收起 AI 助手" : "展开 AI 助手"}
                  aria-pressed={assistantOpen}
                >
                  <Bot aria-hidden="true" />
                  <span>AI 助手</span>
                </button>
              ) : null}
              <span className="user-chip">
                <UserCog aria-hidden="true" />
                {currentUser.email}
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={handleLogout}
                title="退出登录"
              >
                <LogOut aria-hidden="true" />
              </button>
            </div>
          </header>

          {error ? <div className="error-banner">{error}</div> : null}

          {activeTab === "overview" ? (
            <Overview
              summary={summary}
              providers={providers}
              models={models}
              tasks={tasks}
            />
          ) : null}
          {activeTab === "users" ? (
            <UsersPanel users={users} sessions={sessions} mutate={mutate} />
          ) : null}
          {activeTab === "providers" ? (
            <ApiSettingsPanel
              providers={providers}
              models={models}
              refresh={loadAdminData}
            />
          ) : null}
          {activeTab === "assistant" ? (
            <AdminAssistantSettingsPanel
              settings={assistantSettings}
              saving={busy}
              onSave={async (next) => {
                setBusy(true);
                setError("");
                try {
                  const saved = await api<AssistantSettings>("/api/admin/assistant/settings", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(next),
                  });
                  setAssistantSettings(saved);
                } catch (nextError) {
                  if (nextError instanceof AdminApiError && nextError.code === "ADMIN_SETTINGS_REVISION_CONFLICT") {
                    const latestSettings = await api<AssistantSettings>("/api/admin/assistant/settings");
                    setAssistantSettings(latestSettings);
                    setError("AI 助手配置已在其他页面更新，已刷新为最新版本，请重新确认后再保存。");
                  } else {
                    setError(nextError instanceof Error ? nextError.message : String(nextError));
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
          {activeTab === "tasks" ? (
            <TasksPanel tasks={tasks} mutate={mutate} />
          ) : null}
          {activeTab === "audit" ? (
            <AuditPanel auditLogs={auditLogs} />
          ) : null}
          {activeTab === "system" ? (
            <SystemPanel
              system={system}
              saving={busy}
              onSave={async ({ taskQueueSettings, revision }) => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/admin/system", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ taskQueueSettings, revision }),
                  });
                  await loadAdminData();
                } catch (nextError) {
                  if (nextError instanceof AdminApiError && nextError.code === "ADMIN_SETTINGS_REVISION_CONFLICT") {
                    const latestSystem = await api<SystemInfo>("/api/admin/system");
                    setSystem(latestSystem);
                    setError("任务并发配置已在其他页面更新，已刷新为最新版本，请重新确认后再保存。");
                  } else {
                    setError(nextError instanceof Error ? nextError.message : String(nextError));
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </main>

        <AdminAssistantPanel
          open={assistantSettings.backend.enabled && assistantOpen}
          onToggle={() => setAssistantOpen((current) => !current)}
          onOpenChange={(next) => setAssistantOpen(next)}
          activeTab={activeTab}
          providers={providers}
          models={models}
          tasks={tasks}
          auditLogs={auditLogs}
          users={users}
          settings={assistantSettings.backend}
        />
      </div>
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

function LoginView({
  busy,
  error,
  onLogin,
}: {
  busy: boolean;
  error: string;
  onLogin: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
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
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="spin" aria-hidden="true" />
          ) : (
            <KeyRound aria-hidden="true" />
          )}
          进入后台
        </button>
      </form>
    </div>
  );
}

function ForbiddenView({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <div className="center-screen">
      <ShieldCheck aria-hidden="true" />
      <h1>需要管理员权限</h1>
      <p>{user.email}</p>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
