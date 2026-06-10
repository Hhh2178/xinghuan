import type { AssistantChatAttachment } from "./admin-types";

export const ADMIN_ASSISTANT_APPEND_CONTEXT_EVENT = "xinghuan:admin-assistant-append-context";

export interface AdminAssistantAppendContextDetail {
  attachments?: AssistantChatAttachment[];
  message?: string;
  open?: boolean;
}

export function appendAdminAssistantContext(detail: AdminAssistantAppendContextDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_ASSISTANT_APPEND_CONTEXT_EVENT, { detail }));
}
