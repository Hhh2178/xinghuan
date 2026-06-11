import {
  Activity,
  Bot,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  ServerCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TaskStatus } from "@xinghuan/shared";

export type AdminTabId = "overview" | "users" | "providers" | "assistant" | "tasks" | "audit" | "system";
export type StatusTone = "success" | "danger" | "muted" | "warning";
export type ModelCapability = "chat" | "image" | "video" | "audio";

export const adminNavItems: Array<{ id: AdminTabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "users", label: "用户", icon: Users },
  { id: "providers", label: "API 设置", icon: KeyRound },
  { id: "assistant", label: "AI 助手", icon: Bot },
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
