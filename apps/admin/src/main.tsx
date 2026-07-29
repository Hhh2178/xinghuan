import { Bot, KeyRound, Loader2, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { type TaskStatus } from "@xinghuan/shared";
import { adminAnnouncementApi, adminAuditApi, AdminApiError, api, isAuthRequiredError } from "./admin-api-client";
import { AdminAssistantPanel } from "./admin-assistant-panel";
import { ConfirmActionDialog } from "./admin-confirm-action-dialog";
import { readAdminShellSnapshot, readAdminWorkspaceSnapshot } from "./admin-data-loaders";
import { ManualModelDialog } from "./admin-manual-model-dialog";
import { AdminShellWorkspaceBand } from "./admin-shell-workspace-band";
import { AdminRouteErrorBoundary } from "./admin-route-error-boundary";
import { createAdminLazyImportWithRecovery } from "./admin-lazy-import-recovery";
import { useAdminSystemHealth } from "./use-admin-system-health";
import type {
  AdminUser as AdminUserShape,
  AdminUserGroup as AdminUserGroupShape,
  AdminSessionRecord as AdminSessionRecordShape,
  AuditRecord as AuditRecordShape,
  AdminUsageSummary as AdminUsageSummaryShape,
  AuthUser as AuthUserShape,
  Capability as CapabilityShape,
  ConfirmAction as ConfirmActionShape,
  ModelRecord as ModelRecordShape,
  ModelScopeLora,
  ProviderProtocol,
  ProviderRecord as ProviderRecordShape,
  RunningHubEntry,
  AssistantSettings as AssistantSettingsShape,
  AdminAnnouncementRecord as AdminAnnouncementRecordShape,
  Summary as SummaryShape,
  SystemInfo as SystemInfoShape,
  TaskListPage as TaskListPageShape,
  TaskRecord as TaskRecordShape,
  UsageCapability as UsageCapabilityShape,
} from "./admin-types";
import {
  adminCapabilitiesViews,
  adminAgentRuntimeViews,
  adminAnalyticsViews,
  adminRhViews,
  adminSystemViews,
  adminWorkspaces,
  descriptionForWorkspaceTab,
  refreshPolicyFor,
  tabsForWorkspace,
  titleFor,
  usersViewsForWorkspace,
  workspaceForTab,
} from "./admin-view-model";
import { useAdminNavigation } from "./use-admin-navigation";
import "./styles.css"; import "./styles/admin-foundation.css"; import "./styles/admin-configuration-workbench.css"; import "./styles/admin-data-workbench.css"; import "./styles/admin-governance-workbench.css"; import "./styles/route-shell.css";

void ConfirmActionDialog;
void ManualModelDialog;

const ADMIN_ASSISTANT_STORAGE_KEY = "xinghuan.adminAssistant.open";

const Overview = lazy(createAdminLazyImportWithRecovery(() => import("./admin-overview-panel").then((module) => ({ default: module.Overview })), { recoveryId: "overview" }));
const UsersPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-users-panel").then((module) => ({ default: module.UsersPanel })), { recoveryId: "users" }));
const ApiSettingsPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-api-settings-panel").then((module) => ({ default: module.ApiSettingsPanel })), { recoveryId: "providers" }));
const AdminRunningHubWorkspace = lazy(createAdminLazyImportWithRecovery(() => import("./admin-runninghub-workspace").then((module) => ({ default: module.AdminRunningHubWorkspace })), { recoveryId: "runninghub" }));
const AdminComfyuiInstancesPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-comfyui-instances-panel"), { recoveryId: "comfyui" }));
const AdminPublicResourcesPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-public-resources-panel").then((module) => ({ default: module.AdminPublicResourcesPanel })), { recoveryId: "resources" }));
const AdminAssistantGovernanceWorkspace = lazy(createAdminLazyImportWithRecovery(() => import("./admin-assistant-governance-workspace").then((module) => ({ default: module.AdminAssistantGovernanceWorkspace })), { recoveryId: "assistant-governance" }));
const AdminAgentGovernanceWorkspace = lazy(createAdminLazyImportWithRecovery(() => import("./admin-agent-governance-workspace").then((module) => ({ default: module.AdminAgentGovernanceWorkspace })), { recoveryId: "agent-runtime" }));
const AdminAnnouncementPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-announcement-panel").then((module) => ({ default: module.AdminAnnouncementPanel })), { recoveryId: "announcements" }));
const TasksPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-task-panel").then((module) => ({ default: module.TasksPanel })), { recoveryId: "tasks" }));
const AuditPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-readonly-panels").then((module) => ({ default: module.AuditPanel })), { recoveryId: "analytics" }));
const SystemPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-readonly-panels").then((module) => ({ default: module.SystemPanel })), { recoveryId: "system" }));
const AdminEnvironmentSyncPanel = lazy(createAdminLazyImportWithRecovery(() => import("./admin-environment-sync-panel").then((module) => ({ default: module.AdminEnvironmentSyncPanel })), { recoveryId: "environment-sync" }));

export type Capability = CapabilityShape;
export type ConfirmAction = ConfirmActionShape;

export interface AuthUser extends AuthUserShape {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}

export interface AdminUser extends AuthUser {
  groupId?: string;
  groupName?: string;
  remark: string;
  disabled: boolean;
  passwordAvailable: boolean;
  password: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminSessionRecord extends AdminSessionRecordShape {}
export interface AdminUserGroup extends AdminUserGroupShape {}

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
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRemark?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  ownerDeleted?: boolean;
  providerId?: string;
  modelId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  displayStatus?: string;
  displayMessage?: string;
  displayTone?: "muted" | "warning" | "success" | "danger";
  runtimeStage?: string;
  providerState?: string;
  logs: string[];
  createdAt?: number;
  updatedAt: number;
}

export interface TaskListPage extends TaskListPageShape {}

export interface AssistantSettings extends AssistantSettingsShape {}
export interface AdminAnnouncementRecord extends AdminAnnouncementRecordShape {}

type AuditRecord = AuditRecordShape;
type SystemInfo = SystemInfoShape;
type AdminUsageSummary = AdminUsageSummaryShape;
type UsageCapability = UsageCapabilityShape;
type MutateOptions = {
  suppressGlobalError?: boolean;
  rethrow?: boolean;
};

type UsageSummaryRange = "today" | "7d" | "30d";

type UsageSummaryFilterState = {
  range: UsageSummaryRange;
  groupId: string;
  capability: "" | UsageCapability;
  providerId: string;
};

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
      runtime: "internal",
      frontendAssistantAgentKey: "assistant-planner",
      backendAssistantAgentKey: "admin-assistant-planner",
      providerAnalysisAgentKey: "provider-analysis-planner",
      knowledgeProfile: "public-canvas",
      persistMemory: false,
      strictMode: true,
    },
    updatedAt: Date.now(),
    revision: 1,
  };
}

function defaultTaskListPage(): TaskListPage {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
    windowLimit: 2000,
    windowSize: 0,
    truncated: false,
    filters: {
      status: "",
      providerId: "",
      capability: "",
    },
  };
}

function taskPagePath(page: number, pageSize: number, filters: TaskListPage["filters"]) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.providerId) params.set("providerId", filters.providerId);
  if (filters.capability) params.set("capability", filters.capability);
  return `/api/admin/tasks?${params.toString()}`;
}

function AdminApp() {
  const [authStatus, setAuthStatus] = useState<"checking" | "ready">("checking");
  const [currentUser, setCurrentUser] = useState<AuthUserShape | null>(null);
  const {
    activeTab,
    activeWorkspaceId,
    activeUsersView,
    activeRhView,
    activeAnalyticsView,
    activeSystemView,
    activeComfyuiInstanceId,
    activeComfyuiDetailTab,
    activeCapabilitiesView,
    activeAgentRuntimeView,
    navigateAdmin,
    navigateRhView,
    navigateAnalyticsView,
    navigateSystemView,
    navigateComfyuiInstance,
    navigateCapabilitiesView,
    navigateAgentRuntimeView,
    navigateUsersView,
  } = useAdminNavigation();
  const [assistantOpen, setAssistantOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(ADMIN_ASSISTANT_STORAGE_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
    return true;
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>(defaultAssistantSettings());
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRecordShape[]>([]);
  const [users, setUsers] = useState<AdminUserShape[]>([]);
  const [userGroups, setUserGroups] = useState<AdminUserGroupShape[]>([]);
  const [sessions, setSessions] = useState<AdminSessionRecordShape[]>([]);
  const [providers, setProviders] = useState<ProviderRecordShape[]>([]);
  const [models, setModels] = useState<ModelRecordShape[]>([]);
  const [taskPage, setTaskPage] = useState<TaskListPage>(defaultTaskListPage());
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<AdminUsageSummary | null>(null);
  const [usageFilters, setUsageFilters] = useState<UsageSummaryFilterState>({
    range: "30d",
    groupId: "",
    capability: "",
    providerId: "",
  });
  const [selectedUsageUserId, setSelectedUsageUserId] = useState("");
  const [usageSummaryLoading, setUsageSummaryLoading] = useState(false);
  const [usageSummaryError, setUsageSummaryError] = useState("");
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
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
  const {
    range: systemHealthRange,
    refreshing: systemRefreshing,
    load: loadSystemHealth,
    changeRange: changeSystemHealthRange,
  } = useAdminSystemHealth({
    isAdmin,
    isActive: activeWorkspaceId === "system" && activeSystemView === "health",
    setSystem,
    setCurrentUser,
    setError,
    setLastRefreshAt,
  });

  function handleAuthRequired(nextError: unknown) {
    if (!isAuthRequiredError(nextError)) return false;
    setCurrentUser(null);
    setError("登录状态已失效，请重新登录。");
    return true;
  }

  async function runAdminLoad(work: () => Promise<void>) {
    if (!isAdmin) return;
    setBusy(true);
    setError("");
    try {
      await work();
      setLastRefreshAt(Date.now());
    } catch (nextError) {
      if (!handleAuthRequired(nextError)) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadShellData() {
    await runAdminLoad(async () => {
      const snapshot = await readAdminShellSnapshot();
      setSummary(snapshot.summary);
      setAssistantSettings(snapshot.assistantSettings);
    });
  }

  async function loadWorkspaceData(workspaceId = activeWorkspaceId) {
    await runAdminLoad(async () => {
      const snapshot = await readAdminWorkspaceSnapshot(
        workspaceId,
        taskPagePath(taskPage.page, taskPage.pageSize, taskPage.filters),
        systemHealthRange,
      );
      if (snapshot.users) setUsers(snapshot.users);
      if (snapshot.userGroups) setUserGroups(snapshot.userGroups);
      if (snapshot.sessions) setSessions(snapshot.sessions);
      if (snapshot.providers) setProviders(snapshot.providers);
      if (snapshot.models) setModels(snapshot.models);
      if (snapshot.taskPage) setTaskPage(snapshot.taskPage);
      if (snapshot.auditLogs) setAuditLogs(snapshot.auditLogs);
      if (snapshot.announcements) setAnnouncements(snapshot.announcements);
      if (snapshot.system) setSystem(snapshot.system);
    });
  }

  async function loadAnnouncements() {
    if (!isAdmin) return;
    const nextAnnouncements = await adminAnnouncementApi.listAnnouncements();
    setAnnouncements(nextAnnouncements);
    setLastRefreshAt(Date.now());
  }

  async function loadTaskPage(page = taskPage.page, pageSize = taskPage.pageSize, filters = taskPage.filters) {
    if (!isAdmin) return;
    const nextTaskPage = await api<TaskListPage>(taskPagePath(page, pageSize, filters));
    setTaskPage(nextTaskPage);
    setLastRefreshAt(Date.now());
  }

  async function loadUsageSummary(
    nextFilters = usageFilters,
    nextSelectedUsageUserId = selectedUsageUserId,
  ) {
    if (!isAdmin) return;
    setUsageSummaryLoading(true);
    setUsageSummaryError("");
    try {
      const nextUsageSummary = await adminAuditApi.readUsageSummary({
        range: nextFilters.range,
        groupId: nextFilters.groupId || undefined,
        capability: nextFilters.capability || undefined,
        providerId: nextFilters.providerId || undefined,
        userId: nextSelectedUsageUserId || undefined,
      });
      setUsageSummary(nextUsageSummary);
      setLastRefreshAt(Date.now());
    } catch (nextError) {
      setUsageSummaryError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setUsageSummaryLoading(false);
    }
  }

  function handleUsageFiltersChange(nextFilters: UsageSummaryFilterState) {
    setUsageFilters(nextFilters);
    if (nextFilters.groupId && selectedUsageUserId) {
      const selectedUser = users.find((item) => item.id === selectedUsageUserId);
      if (selectedUser && selectedUser.groupId !== nextFilters.groupId) {
        setSelectedUsageUserId("");
      }
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void loadShellData();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadWorkspaceData(activeWorkspaceId);
  }, [activeWorkspaceId, isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeWorkspaceId !== "analytics" || activeAnalyticsView !== "usage") return;
    void loadUsageSummary();
  }, [
    isAdmin,
    activeWorkspaceId,
    activeAnalyticsView,
    usageFilters.range,
    usageFilters.groupId,
    usageFilters.capability,
    usageFilters.providerId,
    selectedUsageUserId,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    const hasActiveTasks = taskPage.items.some((task) => task.status === "queued" || task.status === "running");
    const shouldLiveRefresh = activeTab === "tasks" || hasActiveTasks;
    if (!shouldLiveRefresh) return;
    const timer = window.setInterval(() => {
      void loadTaskPage();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeTab, isAdmin, taskPage.items, taskPage.page, taskPage.pageSize, taskPage.filters.status, taskPage.filters.providerId, taskPage.filters.capability]);

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
      if (nextError instanceof AdminApiError && nextError.code === "LOGIN_RATE_LIMITED") {
        setError(
          nextError.retryAfterSec
            ? `登录尝试过多，请在 ${Math.max(1, Math.ceil(nextError.retryAfterSec / 60))} 分钟后重试。`
            : "登录尝试过多，请稍后再试。",
        );
      } else {
        const message = nextError instanceof Error ? nextError.message : "";
        setError(message === "ADMIN_REQUIRED" ? "该账号没有后台管理员权限。" : "登录失败，请检查账号和密码。");
      }
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
    options?: MutateOptions,
  ) {
    const shouldSetGlobalError = !options?.suppressGlobalError;
    const shouldRethrow = Boolean(options?.rethrow);
    setBusy(true);
    if (shouldSetGlobalError) setError("");
    try {
      await api(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadWorkspaceData(activeWorkspaceId);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      const authRequired = handleAuthRequired(nextError);
      if (!authRequired) setError(shouldSetGlobalError ? message : "");
      if (shouldRethrow) {
        throw nextError instanceof Error ? nextError : new Error(message);
      }
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

  const activeWorkspace = workspaceForTab(activeTab, activeWorkspaceId);
  const activeWorkspaceTabs = tabsForWorkspace(activeWorkspace.id);
  const activeUsersPage = activeTab === "users"
    ? usersViewsForWorkspace(activeWorkspace.id).find((item) => item.id === activeUsersView)
    : undefined;
  const activeRhPage = activeWorkspace.id === "rh" ? adminRhViews.find((item) => item.id === activeRhView) : undefined;
  const activeAnalyticsPage = activeWorkspace.id === "analytics" ? adminAnalyticsViews.find((item) => item.id === activeAnalyticsView) : undefined;
  const activeSystemPage = activeWorkspace.id === "system" ? adminSystemViews.find((item) => item.id === activeSystemView) : undefined;
  const activeCapabilitiesPage = activeWorkspace.id === "capabilities" ? adminCapabilitiesViews.find((item) => item.id === activeCapabilitiesView) : undefined;
  const activeAgentRuntimePage = activeWorkspace.id === "automation" ? adminAgentRuntimeViews.find((item) => item.id === activeAgentRuntimeView) : undefined;
  const activeSubpages = activeTab === "users" ? usersViewsForWorkspace(activeWorkspace.id) : activeWorkspace.id === "rh" ? adminRhViews : activeWorkspace.id === "analytics" ? adminAnalyticsViews : activeWorkspace.id === "system" ? adminSystemViews : activeWorkspace.id === "capabilities" ? adminCapabilitiesViews : activeWorkspace.id === "automation" ? adminAgentRuntimeViews : [];
  const activeSubpageId = activeTab === "users" ? activeUsersView : activeWorkspace.id === "rh" ? activeRhView : activeWorkspace.id === "analytics" ? activeAnalyticsView : activeWorkspace.id === "system" ? activeSystemView : activeWorkspace.id === "capabilities" ? activeCapabilitiesView : activeWorkspace.id === "automation" ? activeAgentRuntimeView : undefined;
  const currentPageLabel = activeUsersPage?.label || activeRhPage?.label || activeAnalyticsPage?.label || activeSystemPage?.label || activeCapabilitiesPage?.label || activeAgentRuntimePage?.label || activeWorkspaceTabs.find((item) => item.id === activeTab)?.label || titleFor(activeTab);
  const currentPageDescription = activeUsersPage?.description || activeRhPage?.description || activeAnalyticsPage?.description || activeSystemPage?.description || activeCapabilitiesPage?.description || activeAgentRuntimePage?.description || descriptionForWorkspaceTab(activeWorkspace.id, activeTab);
  const refreshPolicy = refreshPolicyFor(activeTab);
  const lastRefreshLabel = lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString("zh-CN", { hour12: false }) : "等待首次同步";

  return (
    <div className="starlight-shell admin-shell">
      <aside className="starlight-sidebar admin-sidebar">
        <div className="starlight-brand brand-mark">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>星幻无限画布</strong>
            <span>{summary?.environment || "gray"} · Admin Console</span>
          </div>
        </div>
        <nav className="starlight-domain-nav" aria-label="后台工作域">
          {adminWorkspaces.map((workspace) => {
            const Icon = workspace.icon;
            const selected = activeWorkspace.id === workspace.id;
            return (
              <button
                type="button"
                className={selected ? "active" : ""}
                key={workspace.id}
                onClick={() => navigateAdmin(workspace.id)}
                aria-current={selected ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>
                  <strong>{workspace.label}</strong>
                  <small>{workspace.subtitle}</small>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="starlight-sidebar__footer">
          <span>当前页面</span>
          <strong>{currentPageLabel}</strong>
          <small>{currentPageDescription}</small>
        </div>
      </aside>

      <div className={`admin-workspace${assistantOpen ? " admin-workspace--with-assistant" : ""}`}>
        <main className={`admin-main${activeAgentRuntimeView === "assistants" ? " admin-main--assistant-settings" : ""}`}>
          <header className="starlight-topbar admin-topbar">
            <div>
              <p>星幻无限画布 · Admin Console</p>
              <strong className="admin-topbar__title">全局运行状态</strong>
            </div>
            <div className="topbar-actions">
              <span className={`starlight-refresh-policy starlight-refresh-policy--${refreshPolicy.kind}`} title={refreshPolicy.description}>
                {refreshPolicy.label} · {refreshPolicy.intervalLabel}
              </span>
              <span className="starlight-refresh-time">最近刷新 {lastRefreshLabel}</span>
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

          <AdminShellWorkspaceBand
            workspace={activeWorkspace}
            workspaceTabs={activeWorkspaceTabs}
            activeTab={activeTab}
            currentLabel={currentPageLabel}
            currentDescription={currentPageDescription}
            refreshLabel={refreshPolicy.label}
            refreshIntervalLabel={refreshPolicy.intervalLabel}
            subpages={activeSubpages}
            activeSubpage={activeSubpageId}
            onNavigateTab={(tabId) => navigateAdmin(activeWorkspace.id, tabId)}
            onNavigateSubpage={(subpageId) => activeTab === "users"
              ? navigateUsersView(subpageId as typeof activeUsersView)
              : activeWorkspace.id === "rh"
                ? navigateRhView(subpageId as typeof activeRhView)
                : activeWorkspace.id === "analytics"
                  ? navigateAnalyticsView(subpageId as typeof activeAnalyticsView)
                  : activeWorkspace.id === "system"
                    ? navigateSystemView(subpageId as typeof activeSystemView)
                    : activeWorkspace.id === "automation"
                      ? navigateAgentRuntimeView(subpageId as typeof activeAgentRuntimeView)
                    : navigateCapabilitiesView(subpageId as typeof activeCapabilitiesView)}
          />

          <AdminRouteErrorBoundary resetKey={`${activeWorkspace.id}:${activeTab}:${activeSubpageId || "root"}`}>
          <Suspense fallback={<div className="starlight-page-loading"><Loader2 className="spin" aria-hidden="true" /> 正在加载后台模块...</div>}>
          {activeTab === "overview" ? (
            <Overview
              summary={summary}
              providers={providers}
              models={models}
              tasks={taskPage.items}
            />
          ) : null}
          {activeTab === "users" ? (
            <UsersPanel
              initialView={activeWorkspace.usersView}
              activeView={activeUsersView}
              onViewChange={navigateUsersView}
              showLocalNavigation={false}
              users={users}
              userGroups={userGroups}
              sessions={sessions}
              mutate={mutate}
              onOpenAudit={() => navigateAdmin("analytics", "audit")}
            />
          ) : null}
          {activeTab === "providers" ? (
            <ApiSettingsPanel
              providers={providers}
              models={models}
              activeView={activeCapabilitiesView === "models" ? "models" : "providers"}
              refresh={() => loadWorkspaceData("capabilities")}
            />
          ) : null}
          {activeTab === "runninghub-workspace" ? (
            <AdminRunningHubWorkspace activeView={activeRhView} onViewChange={navigateRhView} showLocalNavigation={false} />
          ) : null}
          {activeTab === "comfyui" ? (
            <AdminComfyuiInstancesPanel instanceId={activeComfyuiInstanceId} detailTab={activeComfyuiDetailTab} onNavigate={navigateComfyuiInstance} />
          ) : null}
          {activeTab === "public-resources" ? (
            <AdminPublicResourcesPanel />
          ) : null}
          {activeTab === "agent-runtime" && activeAgentRuntimeView === "assistants" ? (
            <AdminAssistantGovernanceWorkspace
              settings={assistantSettings}
              models={models}
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
          {activeTab === "agent-runtime" && activeAgentRuntimeView !== "assistants" ? (
            <AdminAgentGovernanceWorkspace activeView={activeAgentRuntimeView} models={models} />
          ) : null}
          {activeTab === "announcement" ? (
            <AdminAnnouncementPanel
              items={announcements}
              loading={busy && !announcements.length}
              busy={busy}
              onReload={loadAnnouncements}
              onCreate={async (payload) => {
                setBusy(true);
                setError("");
                try {
                  await adminAnnouncementApi.createAnnouncement(payload);
                  await loadAnnouncements();
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : String(nextError));
                } finally {
                  setBusy(false);
                }
              }}
              onUpdate={async (id, payload) => {
                setBusy(true);
                setError("");
                try {
                  await adminAnnouncementApi.updateAnnouncement(id, payload);
                  await loadAnnouncements();
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : String(nextError));
                } finally {
                  setBusy(false);
                }
              }}
              onPublish={async (id, payload) => {
                setBusy(true);
                setError("");
                try {
                  await adminAnnouncementApi.publishAnnouncement(id, payload);
                  await loadAnnouncements();
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : String(nextError));
                } finally {
                  setBusy(false);
                }
              }}
              onArchive={async (id) => {
                setBusy(true);
                setError("");
                try {
                  await adminAnnouncementApi.archiveAnnouncement(id);
                  await loadAnnouncements();
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : String(nextError));
                } finally {
                  setBusy(false);
                }
              }}
              onDelete={async (id) => {
                setBusy(true);
                setError("");
                try {
                  await adminAnnouncementApi.deleteAnnouncement(id);
                  await loadAnnouncements();
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : String(nextError));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
          {activeTab === "tasks" ? (
            <TasksPanel
              taskPage={taskPage}
              mutate={mutate}
              onQueryChange={(next) => {
                void loadTaskPage(next.page, next.pageSize, next.filters);
              }}
            />
          ) : null}
          {activeTab === "audit" ? (
            <AuditPanel
              activeView={activeAnalyticsView}
              auditLogs={auditLogs}
              usageSummary={usageSummary}
              usageSummaryLoading={usageSummaryLoading}
              usageSummaryError={usageSummaryError}
              usageFilters={usageFilters}
              selectedUsageUserId={selectedUsageUserId}
              users={users}
              userGroups={userGroups}
              providers={providers}
              models={models}
              onUsageFiltersChange={handleUsageFiltersChange}
              onSelectedUsageUserIdChange={setSelectedUsageUserId}
            />
          ) : null}
          {activeTab === "system" ? (
            <SystemPanel
              activeView={activeSystemView === "runtime-settings" ? "runtime-settings" : "health"}
              system={system}
              saving={busy}
              refreshing={systemRefreshing}
              onHealthRangeChange={changeSystemHealthRange}
              onHealthRefresh={() => void loadSystemHealth(systemHealthRange)}
              onSave={async ({ taskQueueSettings, revision }) => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/admin/system", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ taskQueueSettings, revision }),
                  });
                  await loadWorkspaceData("system");
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
          {activeTab === "environment-sync" ? (
            <AdminEnvironmentSyncPanel
              onBusyChange={setBusy}
              onError={setError}
            />
          ) : null}
          </Suspense>
          </AdminRouteErrorBoundary>
        </main>

        <AdminAssistantPanel
          open={assistantSettings.backend.enabled && assistantOpen}
          onToggle={() => setAssistantOpen((current) => !current)}
          onOpenChange={(next) => setAssistantOpen(next)}
          activeTab={activeTab}
          providers={providers}
          models={models}
          tasks={taskPage.items}
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
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          密码
          <input
            type="password"
            autoComplete="current-password"
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
