import {
  Activity,
  Bell,
  Bot,
  Combine,
  KeyRound,
  Library,
  LayoutDashboard,
  PanelsTopLeft,
  ScrollText,
  ServerCog,
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
  | "public-resources"
  | "assistant"
  | "announcement"
  | "tasks"
  | "audit"
  | "system"
  | "environment-sync";
export type AdminWorkspaceId =
  | "command-center"
  | "capability-console"
  | "resource-content"
  | "governance-center"
  | "ops-center";
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
  { id: "public-resources", label: "公共资源", icon: Library },
  { id: "assistant", label: "AI 助手", icon: Bot },
  { id: "announcement", label: "公告", icon: Bell },
  { id: "tasks", label: "任务", icon: Activity },
  { id: "audit", label: "审计", icon: ScrollText },
  { id: "system", label: "系统", icon: ServerCog },
  { id: "environment-sync", label: "环境同步", icon: Combine },
];

export const adminWorkspaces: AdminWorkspace[] = [
  {
    id: "command-center",
    label: "运营总览",
    subtitle: "Command Center",
    description: "平台健康、任务态势、用量趋势、风险告警和最近变更。",
    icon: LayoutDashboard,
    tabs: ["overview"],
  },
  {
    id: "capability-console",
    label: "能力配置",
    subtitle: "Capability Console",
    description: "Provider、模型、RunningHub、节点能力和 AI 助手接入。",
    icon: KeyRound,
    tabs: ["providers", "runninghub-workspace", "assistant"],
  },
  {
    id: "resource-content",
    label: "资源与内容",
    subtitle: "Resource & Content",
    description: "公共资源、公告、分类与标签治理，以及完整素材预览与上传管理。",
    icon: Library,
    tabs: ["public-resources", "announcement"],
  },
  {
    id: "governance-center",
    label: "组织与治理",
    subtitle: "Governance Center",
    description: "账号、用户组、权限、会话、成功用量与审计日志。",
    icon: Users,
    tabs: ["users", "audit"],
  },
  {
    id: "ops-center",
    label: "系统与发布",
    subtitle: "Ops Center",
    description: "系统健康、任务队列、运行参数、环境同步与发布状态。",
    icon: ServerCog,
    tabs: ["tasks", "system", "environment-sync"],
  },
];

export const adminTabDescriptions: Record<AdminTabId, string> = {
  overview: "平台健康、用量趋势、队列风险和最近变更。",
  users: "账号、用户组、权限策略和会话治理。",
  providers: "Provider 接入、模型目录、Key 状态和模型拉取。",
  "runninghub-workspace": "RunningHub AI 应用、工作流、输入槽、Schema 和测试。",
  "public-resources": "公共素材上传、分类、卡片预览、编辑和权限摘要。",
  assistant: "创作侧与后台 AI 助手、接入内核和上下文权限。",
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
  "public-resources": { kind: "manual", label: "手动刷新", intervalLabel: "按需", description: "资源上传和编辑完成后局部刷新列表。" },
  assistant: { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "AI 助手配置使用 revision 冲突保护。" },
  announcement: { kind: "guarded", label: "受保护刷新", intervalLabel: "按需", description: "公告草稿编辑期间不自动覆盖。" },
  tasks: { kind: "live", label: "自动刷新", intervalLabel: "3-5 秒", description: "queued / running 任务和日志保持热刷新。" },
  audit: { kind: "manual", label: "手动刷新", intervalLabel: "按需", description: "用量统计按筛选条件重新计算。" },
  system: { kind: "live", label: "自动刷新", intervalLabel: "5-10 秒", description: "数据库、Redis、Worker、队列和告警保持热刷新。" },
  "environment-sync": { kind: "manual", label: "手动刷新", intervalLabel: "预览后", description: "环境差异必须先预览，再人工确认同步。" },
};

export function workspaceForTab(tabId: AdminTabId): AdminWorkspace {
  return adminWorkspaces.find((workspace) => workspace.tabs.includes(tabId)) || adminWorkspaces[0];
}

export function tabsForWorkspace(workspaceId: AdminWorkspaceId) {
  const workspace = adminWorkspaces.find((item) => item.id === workspaceId);
  if (!workspace) return [];
  return workspace.tabs
    .map((tabId) => adminNavItems.find((item) => item.id === tabId))
    .filter((item): item is { id: AdminTabId; label: string; icon: LucideIcon } => Boolean(item));
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
