import {
  Activity,
  Bell,
  Bot,
  Combine,
  KeyRound,
  Library,
  LayoutDashboard,
  PanelsTopLeft,
  Route,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Workflow,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TaskStatus } from "@xinghuan/shared";
import type { TaskRecord } from "./admin-types";

export type AdminTabId =
  | "overview"
  | "users"
  | "providers"
  | "runninghub-workspace"
  | "comfyui"
  | "public-resources"
  | "assistant"
  | "agent-runtime"
  | "announcement"
  | "tasks"
  | "audit"
  | "system"
  | "environment-sync";
export type AdminWorkspaceId =
  | "overview"
  | "organization"
  | "security"
  | "capabilities"
  | "automation"
  | "rh"
  | "comfyui"
  | "resources"
  | "content"
  | "runtime"
  | "analytics"
  | "system";
export type AdminUsersViewId = "overview" | "accounts" | "groups" | "permissions" | "sessions";
export type AdminRhViewId = "workflows" | "apps" | "keys";
export type AdminAnalyticsViewId = "usage" | "costs" | "audit";
export type AdminSystemViewId = "health" | "runtime-settings" | "environment-sync";
export type AdminCapabilitiesViewId = "providers" | "models" | "admin-assistant";
export type AdminAgentRuntimeViewId = "controls" | "models" | "policies" | "activity";
export type StatusTone = "success" | "danger" | "muted" | "warning";
export type ModelCapability = "chat" | "image" | "video" | "audio";
export type RefreshPolicyKind = "live" | "manual" | "guarded";

export interface AdminWorkspace {
  id: AdminWorkspaceId;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  tabs: AdminTabId[];
  tabPaths: Partial<Record<AdminTabId, string>>;
  tabLabels?: Partial<Record<AdminTabId, string>>;
  tabDescriptions?: Partial<Record<AdminTabId, string>>;
  usersView?: AdminUsersViewId;
}

export interface AdminRefreshPolicy {
  kind: RefreshPolicyKind;
  label: string;
  intervalLabel: string;
  description: string;
}

export const adminNavItems: Array<{ id: AdminTabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "users", label: "用户", icon: Users },
  { id: "providers", label: "API 设置", icon: KeyRound },
  { id: "runninghub-workspace", label: "RH 工作台", icon: PanelsTopLeft },
  { id: "comfyui", label: "ComfyUI", icon: Workflow },
  { id: "public-resources", label: "公共资源", icon: Library },
  { id: "assistant", label: "AI 助手", icon: Bot },
  { id: "agent-runtime", label: "智能体治理", icon: Route },
  { id: "announcement", label: "公告", icon: Bell },
  { id: "tasks", label: "任务", icon: Activity },
  { id: "audit", label: "审计", icon: ScrollText },
  { id: "system", label: "系统", icon: ServerCog },
  { id: "environment-sync", label: "环境同步", icon: Combine },
];

export const adminWorkspaces: AdminWorkspace[] = [
  {
    id: "overview",
    label: "运营总览",
    subtitle: "Command Center",
    description: "平台健康、任务态势、用量趋势、风险告警和最近变更。",
    icon: LayoutDashboard,
    tabs: ["overview"],
    tabPaths: { overview: "/admin/overview" },
  },
  {
    id: "organization",
    label: "账号与组织",
    subtitle: "Organization",
    description: "账号、用户组、成员关系和后台会话治理。",
    icon: Users,
    tabs: ["users"],
    tabPaths: { users: "/admin/organization" },
    tabLabels: { users: "组织总览" },
    tabDescriptions: { users: "管理账号、用户组、成员关系和后台会话。" },
    usersView: "overview",
  },
  {
    id: "security",
    label: "权限与安全",
    subtitle: "Access & Security",
    description: "权限策略、对象授权、安全边界和敏感操作治理。",
    icon: ShieldCheck,
    tabs: ["users"],
    tabPaths: { users: "/admin/security" },
    tabLabels: { users: "权限策略" },
    tabDescriptions: { users: "管理用户组权限、对象授权和访问边界。" },
    usersView: "permissions",
  },
  {
    id: "capabilities",
    label: "Provider 与模型",
    subtitle: "Provider & Model",
    description: "Provider 接入、模型目录、能力标签、路由和后台 AI 助手配置。",
    icon: KeyRound,
    tabs: ["providers", "assistant"],
    tabPaths: {
      providers: "/admin/capabilities/providers",
      assistant: "/admin/capabilities/admin-assistant",
    },
    tabLabels: { providers: "Provider 与模型", assistant: "后台 AI 助手" },
  },
  {
    id: "automation",
    label: "智能体与自动化",
    subtitle: "Agent Operations",
    description: "固定 AI 用途、LLM 路由、质量恢复、运行审批和审计治理。",
    icon: Route,
    tabs: ["agent-runtime"],
    tabPaths: { "agent-runtime": "/admin/automation" },
    tabLabels: { "agent-runtime": "智能体治理" },
  },
  {
    id: "rh",
    label: "RH 管理",
    subtitle: "RunningHub",
    description: "RH 工作流、AI 应用、Key 池、调用测试和运行记录。",
    icon: PanelsTopLeft,
    tabs: ["runninghub-workspace"],
    tabPaths: { "runninghub-workspace": "/admin/rh" },
    tabLabels: { "runninghub-workspace": "RH 工作台" },
  },
  {
    id: "comfyui",
    label: "ComfyUI 管理",
    subtitle: "ComfyUI",
    description: "ComfyUI 实例、连接器、工作流、共享发布和运行观测。",
    icon: Workflow,
    tabs: ["comfyui"],
    tabPaths: { comfyui: "/admin/comfyui" },
  },
  {
    id: "resources",
    label: "公共资源",
    subtitle: "Shared Resources",
    description: "公共素材上传、分类、预览、编辑与开放范围治理。",
    icon: Library,
    tabs: ["public-resources"],
    tabPaths: { "public-resources": "/admin/resources" },
  },
  {
    id: "content",
    label: "内容发布",
    subtitle: "Content Publishing",
    description: "公告、强提醒、置顶与展示策略治理。",
    icon: Bell,
    tabs: ["announcement"],
    tabPaths: { announcement: "/admin/content/announcements" },
  },
  {
    id: "runtime",
    label: "任务与运行",
    subtitle: "Tasks & Runtime",
    description: "任务、队列、失败重试、实时状态和运行日志。",
    icon: Activity,
    tabs: ["tasks"],
    tabPaths: { tasks: "/admin/runtime/tasks" },
  },
  {
    id: "analytics",
    label: "数据分析与审计",
    subtitle: "Analytics & Audit",
    description: "用量、排行、趋势、审计日志和事件调查。",
    icon: ScrollText,
    tabs: ["audit"],
    tabPaths: { audit: "/admin/analytics" },
    tabLabels: { audit: "分析与审计" },
  },
  {
    id: "system",
    label: "系统与发布",
    subtitle: "System & Release",
    description: "系统健康、运行参数、环境同步、版本和发布状态。",
    icon: ServerCog,
    tabs: ["system", "environment-sync"],
    tabPaths: {
      system: "/admin/system/health",
      "environment-sync": "/admin/system/environment-sync",
    },
    tabLabels: { system: "系统健康", "environment-sync": "环境同步" },
  },
];

export const adminTabDescriptions: Record<AdminTabId, string> = {
  overview: "平台健康、用量趋势、队列风险和最近变更。",
  users: "账号、用户组、权限策略和会话治理。",
  providers: "Provider 接入、模型目录、Key 状态和模型拉取。",
  "runninghub-workspace": "RunningHub AI 应用、工作流、输入槽、Schema 和测试。",
  comfyui: "ComfyUI 机器实例、工作流草稿、暴露参数、默认值和共享发布。",
  "public-resources": "公共素材上传、分类、卡片预览、编辑和权限摘要。",
  assistant: "创作侧与后台 AI 助手、接入内核和上下文权限。",
  "agent-runtime": "Agent 角色、仅 LLM 路由池、工具策略、知识、质量、运行和审批。",
  announcement: "公告草稿、发布、强提醒、置顶和弹窗策略。",
  tasks: "任务列表、队列状态、取消、重试和日志查看。",
  audit: "成功用量驾驶舱和后台审计日志。",
  system: "系统健康、Redis、Worker、队列并发和运行参数。",
  "environment-sync": "gray / production 差异预览、冲突决策和同步结果。",
};

export const adminRefreshPolicies: Record<AdminTabId, AdminRefreshPolicy> = {
  overview: { kind: "live", label: "自动刷新", intervalLabel: "5-10 秒", description: "KPI、队列和告警保持热刷新。" },
  users: { kind: "manual", label: "手动刷新", intervalLabel: "按需", description: "账号和权限编辑存在草稿，默认不自动覆盖。" },
  providers: { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "Provider 表单有未保存修改时禁止静默覆盖。" },
  "runninghub-workspace": { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "RH 编辑器保存前保留草稿和测试上下文。" },
  comfyui: { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "ComfyUI 实例与工作流草稿保存前不自动覆盖。" },
  "public-resources": { kind: "manual", label: "手动刷新", intervalLabel: "按需", description: "资源上传和编辑完成后局部刷新列表。" },
  assistant: { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "AI 助手配置使用 revision 冲突保护。" },
  "agent-runtime": { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "版本化配置只在明确保存或发布后更新。" },
  announcement: { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "公告草稿编辑期间不自动覆盖。" },
  tasks: { kind: "live", label: "自动刷新", intervalLabel: "3-5 秒", description: "queued / running 任务和日志保持热刷新。" },
  audit: { kind: "manual", label: "手动刷新", intervalLabel: "按需", description: "用量统计按筛选条件重新计算。" },
  system: { kind: "live", label: "自动刷新", intervalLabel: "5-10 秒", description: "数据库、Redis、Worker、队列和告警保持热刷新。" },
  "environment-sync": { kind: "manual", label: "手动刷新", intervalLabel: "预览后", description: "环境差异必须先预览，再人工确认同步。" },
};

export function workspaceForTab(tabId: AdminTabId, preferredWorkspaceId?: AdminWorkspaceId): AdminWorkspace {
  const preferredWorkspace = preferredWorkspaceId
    ? adminWorkspaces.find((workspace) => workspace.id === preferredWorkspaceId && workspace.tabs.includes(tabId))
    : undefined;
  return preferredWorkspace || adminWorkspaces.find((workspace) => workspace.tabs.includes(tabId)) || adminWorkspaces[0];
}

export interface AdminUsersView {
  id: AdminUsersViewId;
  workspaceId: "organization" | "security";
  label: string;
  description: string;
  path: string;
}

export interface AdminRhView {
  id: AdminRhViewId;
  label: string;
  description: string;
  path: string;
}

export const adminUsersViews: AdminUsersView[] = [
  { id: "overview", workspaceId: "organization", label: "组织总览", description: "查看账号、用户组和会话整体态势。", path: "/admin/organization" },
  { id: "accounts", workspaceId: "organization", label: "账号管理", description: "创建、启停和维护账号基础信息。", path: "/admin/organization/accounts" },
  { id: "groups", workspaceId: "organization", label: "用户组", description: "维护用户组、成员归属和分组基础信息。", path: "/admin/organization/groups" },
  { id: "sessions", workspaceId: "organization", label: "会话管理", description: "巡检活跃会话、来源设备和下线状态。", path: "/admin/organization/sessions" },
  { id: "permissions", workspaceId: "security", label: "权限策略", description: "管理用户组权限、对象授权和访问边界。", path: "/admin/security" },
];

export const adminRhViews: AdminRhView[] = [
  { id: "workflows", label: "工作流", description: "维护 RH 工作流目录、参数结构、测试和启停状态。", path: "/admin/rh/workflows" },
  { id: "apps", label: "AI 应用", description: "维护 RH AI 应用目录、输入配置、测试和启停状态。", path: "/admin/rh/apps" },
  { id: "keys", label: "Key 池", description: "管理 Provider 级共享 Key、默认项和并发额度。", path: "/admin/rh/keys" },
];

export const adminAnalyticsViews = [
  { id: "usage", label: "用量分析", description: "查看用量、排行、能力分布和趋势。", path: "/admin/analytics/usage" },
  { id: "costs", label: "费用分析", description: "查看模型、服务商、用户组和账号的费用与趋势。", path: "/admin/analytics/costs" },
  { id: "audit", label: "审计日志", description: "检索后台操作、请求来源和对象变更。", path: "/admin/analytics/audit" },
] satisfies Array<{ id: AdminAnalyticsViewId; label: string; description: string; path: string }>;

export const adminSystemViews = [
  { id: "health", label: "系统健康", description: "查看数据库、Redis、Worker、队列和观测状态。", path: "/admin/system/health" },
  { id: "runtime-settings", label: "运行参数", description: "维护任务并发和 RH 平台治理开关。", path: "/admin/system/runtime-settings" },
  { id: "environment-sync", label: "环境同步", description: "预览并确认 gray 与 production 的配置差异。", path: "/admin/system/environment-sync" },
] satisfies Array<{ id: AdminSystemViewId; label: string; description: string; path: string }>;

export const adminCapabilitiesViews = [
  { id: "providers", label: "Provider 接入", description: "维护接入地址、协议、密钥和健康验证。", path: "/admin/capabilities/providers" },
  { id: "models", label: "模型目录", description: "维护模型能力、参数结构、排序和连通测试。", path: "/admin/capabilities/models" },
  { id: "admin-assistant", label: "后台 AI 助手", description: "配置后台助手模型、内核和上下文边界。", path: "/admin/capabilities/admin-assistant" },
] satisfies Array<{ id: AdminCapabilitiesViewId; label: string; description: string; path: string }>;

export const adminAgentRuntimeViews = [
  { id: "controls", label: "运行控制", description: "管理环境开关与当前运行态势。", path: "/admin/automation/controls" },
  { id: "models", label: "模型绑定", description: "维护助手、恢复和候选评估的用途配置与 LLM 路由。", path: "/admin/automation/models" },
  { id: "policies", label: "恢复与选择", description: "维护质量门、有限恢复和候选选择策略。", path: "/admin/automation/policies" },
  { id: "activity", label: "运行与审计", description: "查看 Run、审批、恢复决策和不可变审计记录。", path: "/admin/automation/activity" },
] satisfies Array<{ id: AdminAgentRuntimeViewId; label: string; description: string; path: string }>;

export const legacyAgentRuntimeViewAliases: Record<string, AdminAgentRuntimeViewId> = {
  overview: "controls", tools: "controls", nodes: "controls", knowledge: "controls",
  roles: "models", "llm-routes": "models",
  quality: "policies", recovery: "policies",
  runs: "activity", approvals: "activity", audit: "activity",
};

export function tabsForWorkspace(workspaceId: AdminWorkspaceId) {
  const workspace = adminWorkspaces.find((item) => item.id === workspaceId);
  if (!workspace) return [];
  return workspace.tabs
    .map((tabId) => {
      const item = adminNavItems.find((candidate) => candidate.id === tabId);
      if (!item) return undefined;
      return { ...item, label: workspace.tabLabels?.[tabId] || item.label };
    })
    .filter((item): item is { id: AdminTabId; label: string; icon: LucideIcon } => Boolean(item));
}

export function pathForWorkspaceTab(workspaceId: AdminWorkspaceId, tabId?: AdminTabId) {
  const workspace = adminWorkspaces.find((item) => item.id === workspaceId) || adminWorkspaces[0];
  const resolvedTab = tabId && workspace.tabs.includes(tabId) ? tabId : workspace.tabs[0];
  return workspace.tabPaths[resolvedTab] || "/admin/overview";
}

export function descriptionForWorkspaceTab(workspaceId: AdminWorkspaceId, tabId: AdminTabId) {
  const workspace = adminWorkspaces.find((item) => item.id === workspaceId);
  return workspace?.tabDescriptions?.[tabId] || adminTabDescriptions[tabId];
}

export function pathForUsersView(viewId: AdminUsersViewId) {
  return adminUsersViews.find((item) => item.id === viewId)?.path || "/admin/organization";
}

export function usersViewsForWorkspace(workspaceId: AdminWorkspaceId) {
  return adminUsersViews.filter((item) => item.workspaceId === workspaceId);
}

export function pathForRhView(viewId: AdminRhViewId) {
  return adminRhViews.find((item) => item.id === viewId)?.path || "/admin/rh/workflows";
}

export function pathForAnalyticsView(viewId: AdminAnalyticsViewId) {
  return adminAnalyticsViews.find((item) => item.id === viewId)?.path || "/admin/analytics/usage";
}

export function pathForSystemView(viewId: AdminSystemViewId) {
  return adminSystemViews.find((item) => item.id === viewId)?.path || "/admin/system/health";
}

export function pathForCapabilitiesView(viewId: AdminCapabilitiesViewId) {
  return adminCapabilitiesViews.find((item) => item.id === viewId)?.path || "/admin/capabilities/providers";
}

export function pathForAgentRuntimeView(viewId: AdminAgentRuntimeViewId) {
  return adminAgentRuntimeViews.find((item) => item.id === viewId)?.path || "/admin/automation/controls";
}

export function resolveAdminPath(pathname: string): {
  workspaceId: AdminWorkspaceId;
  tabId: AdminTabId;
  usersView?: AdminUsersViewId;
  rhView?: AdminRhViewId;
  analyticsView?: AdminAnalyticsViewId;
  systemView?: AdminSystemViewId;
  comfyuiInstanceId?: string;
  comfyuiDetailTab?: "config" | "workflows" | "logs";
  capabilitiesView?: AdminCapabilitiesViewId;
  agentRuntimeView?: AdminAgentRuntimeViewId;
} {
  const normalizedPath = pathname.replace(/\/$/, "") || "/admin";
  if (normalizedPath === "/admin/content/public-resources" || normalizedPath.startsWith("/admin/content/public-resources/")) {
    return { workspaceId: "resources", tabId: "public-resources" };
  }
  const usersView = normalizedPath.startsWith("/admin/security")
    ? "permissions"
    : normalizedPath.startsWith("/admin/organization/accounts")
      ? "accounts"
      : normalizedPath.startsWith("/admin/organization/groups")
        ? "groups"
        : normalizedPath.startsWith("/admin/organization/sessions")
          ? "sessions"
          : normalizedPath.startsWith("/admin/organization")
            ? "overview"
            : undefined;
  const rhView = normalizedPath.startsWith("/admin/rh/keys")
    ? "keys"
    : normalizedPath.startsWith("/admin/rh/apps")
      ? "apps"
      : normalizedPath.startsWith("/admin/rh")
        ? "workflows"
        : undefined;
  const analyticsView = normalizedPath.startsWith("/admin/analytics/audit")
    ? "audit"
    : normalizedPath.startsWith("/admin/analytics/costs")
      ? "costs"
    : normalizedPath.startsWith("/admin/analytics")
      ? "usage"
      : undefined;
  const systemView = normalizedPath.startsWith("/admin/system/environment-sync")
    ? "environment-sync"
    : normalizedPath.startsWith("/admin/system/runtime-settings")
      ? "runtime-settings"
      : normalizedPath.startsWith("/admin/system")
        ? "health"
        : undefined;
  const comfyuiMatch = normalizedPath.match(/^\/admin\/comfyui\/instances\/([^/]+)(?:\/(config|workflows|logs))?/);
  const comfyuiInstanceId = comfyuiMatch?.[1] ? decodeURIComponent(comfyuiMatch[1]) : undefined;
  const comfyuiDetailTab = comfyuiMatch?.[2] as "config" | "workflows" | "logs" | undefined;
  const capabilitiesView = normalizedPath.startsWith("/admin/capabilities/models")
    ? "models"
    : normalizedPath.startsWith("/admin/capabilities/admin-assistant")
      ? "admin-assistant"
      : normalizedPath.startsWith("/admin/capabilities")
        ? "providers"
        : undefined;
  const agentRuntimeSegment = normalizedPath.match(/^\/admin\/automation\/([^/]+)/)?.[1];
  const agentRuntimeView = normalizedPath.startsWith("/admin/automation/")
    ? adminAgentRuntimeViews.find((item) => normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`))?.id
      || (agentRuntimeSegment ? legacyAgentRuntimeViewAliases[agentRuntimeSegment] : undefined)
    : normalizedPath === "/admin/automation" ? "controls" : undefined;
  const candidates = adminWorkspaces.flatMap((workspace) =>
    workspace.tabs.map((tabId) => ({
      workspaceId: workspace.id,
      tabId,
      path: workspace.tabPaths[tabId] || "",
    })),
  ).sort((left, right) => right.path.length - left.path.length);
  const match = candidates.find((candidate) =>
    candidate.path && (normalizedPath === candidate.path || normalizedPath.startsWith(`${candidate.path}/`)),
  ) || (systemView ? {
    workspaceId: "system" as const,
    tabId: systemView === "environment-sync" ? "environment-sync" as const : "system" as const,
    path: normalizedPath,
  } : capabilitiesView ? {
    workspaceId: "capabilities" as const,
    tabId: capabilitiesView === "admin-assistant" ? "assistant" as const : "providers" as const,
    path: normalizedPath,
  } : undefined);
  return match
    ? { workspaceId: match.workspaceId, tabId: match.tabId, usersView, rhView, analyticsView, systemView, comfyuiInstanceId, comfyuiDetailTab, capabilitiesView, agentRuntimeView }
    : { workspaceId: "overview", tabId: "overview" };
}

export function refreshPolicyFor(tabId: AdminTabId): AdminRefreshPolicy {
  return adminRefreshPolicies[tabId] || adminRefreshPolicies.overview;
}

export function titleFor(tab: string) {
  return adminNavItems.find((item) => item.id === tab)?.label || "总览";
}

export function statusText(status: TaskStatus) {
  return ({ queued: "排队", running: "运行中", succeeded: "成功", failed: "失败", cancelled: "已取消" } as Record<TaskStatus, string>)[status];
}

export function taskTone(status: TaskStatus): StatusTone {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "running") return "warning";
  return "muted";
}

export function taskStatusText(task: Pick<TaskRecord, "status" | "displayStatus">) {
  return String(task.displayStatus || "").trim() || statusText(task.status);
}

export function taskDisplayTone(task: Pick<TaskRecord, "status" | "displayTone">): StatusTone {
  const tone = String(task.displayTone || "").trim();
  return tone === "success" || tone === "danger" || tone === "warning" || tone === "muted"
    ? tone
    : taskTone(task.status);
}

export function capabilityLabel(capability: ModelCapability) {
  return capability === "image" ? "生图" : capability === "video" ? "视频" : capability === "audio" ? "音频" : "聊天";
}

export function modelCapabilityTagLabel(tag: string) {
  return ({
    text_chat: "文本对话",
    image_understanding: "图像理解",
    video_understanding: "视频理解",
    audio_understanding: "音频理解",
    reasoning: "思考推理",
    long_context: "长上下文",
    web_search: "联网",
    image_generation: "图像生成",
    image_edit: "图像编辑",
    video_generation: "视频生成",
    tts: "语音生成",
    voice_design: "音色设计",
    voice_clone: "音色克隆",
    music_generation: "音乐生成",
    audio_cover: "翻唱",
    audio_extend: "续写",
  } as Record<string, string>)[tag] || tag;
}
