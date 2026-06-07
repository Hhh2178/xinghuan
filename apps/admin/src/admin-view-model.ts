import {
  Activity,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  ServerCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TaskStatus } from "@xinghuan/shared";

export type AdminTabId = "overview" | "users" | "providers" | "tasks" | "audit" | "system";
export type StatusTone = "success" | "danger" | "muted" | "warning";

export const adminNavItems: Array<{ id: AdminTabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "users", label: "用户", icon: Users },
  { id: "providers", label: "API 设置", icon: KeyRound },
  { id: "tasks", label: "任务", icon: Activity },
  { id: "audit", label: "审计", icon: ScrollText },
  { id: "system", label: "系统", icon: ServerCog },
];

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
