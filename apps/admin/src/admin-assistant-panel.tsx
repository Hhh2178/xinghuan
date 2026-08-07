import { KeyRound, MonitorCog, RotateCcw, ScrollText, Sparkles, UserCog, Workflow, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createAssistantContentStreamFilter, normalizeAssistantContent } from "@xinghuan/shared";
import { AssistantAttachmentStrip, AssistantComposer, AssistantConversationList, assistantPhaseLabel } from "@xinghuan/ui";
import type {
  AdminUser,
  AssistantChatAttachment,
  AssistantChatResult,
  AssistantProcessEntry,
  AssistantSettings,
  AdminAssistantRuntimeStatus,
  AuditRecord,
  ModelRecord,
  ProviderRecord,
  TaskRecord,
} from "./admin-types";
import { api } from "./admin-api-client";
import {
  ADMIN_ASSISTANT_APPEND_CONTEXT_EVENT,
  type AdminAssistantAppendContextDetail,
} from "./admin-assistant-events";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "agent" | "fallback";
  streaming?: boolean;
  process?: AssistantProcessEntry[];
}

function getAttachmentKindLabel(kind?: string) {
  switch (kind) {
    case "provider":
      return "Provider";
    case "model":
      return "模型";
    case "task":
      return "任务";
    case "audit":
      return "审计";
    case "image":
      return "图片";
    case "user":
      return "用户";
    default:
      return "上下文";
  }
}

function createAssistantConversationId(scope: "canvas" | "admin") {
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function compactAssistantAttachment(item: AssistantChatAttachment): AssistantChatAttachment {
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  const compactPayload: Record<string, unknown> = {};
  for (const key of ["id", "status", "capability", "protocol", "role", "disabled", "action", "targetType", "targetId", "updatedAt"]) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      compactPayload[key] = value;
    }
  }
  if (typeof payload.modelId === "string") compactPayload.modelId = payload.modelId;
  if (typeof payload.baseUrl === "string") {
    compactPayload.baseUrlHost = payload.baseUrl.replace(/^https?:\/\//, "").split("/")[0].slice(0, 120);
  }
  if (item.kind === "image") {
    const mediaUrl =
      typeof payload.url === "string"
        ? payload.url
        : typeof payload.sourceUrl === "string"
          ? payload.sourceUrl
          : "";
    compactPayload.url = mediaUrl;
    compactPayload.sourceUrl = mediaUrl;
    compactPayload.urlHost = mediaUrl ? mediaUrl.replace(/^https?:\/\//, "").split("/")[0].slice(0, 120) : "";
  }
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    payload: compactPayload,
  };
}

export function AdminAssistantPanel({
  open,
  onToggle,
  onOpenChange,
  activeTab,
  providers,
  models,
  tasks,
  auditLogs,
  users,
  settings,
}: {
  open: boolean;
  onToggle: () => void;
  onOpenChange: (next: boolean) => void;
  activeTab: string;
  providers: ProviderRecord[];
  models: ModelRecord[];
  tasks: TaskRecord[];
  auditLogs: AuditRecord[];
  users: AdminUser[];
  settings: AssistantSettings["backend"];
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("就绪");
  const [runtime, setRuntime] = useState<AdminAssistantRuntimeStatus | null>(null);
  const [attachments, setAttachments] = useState<AssistantChatAttachment[]>([]);
  const [conversationId, setConversationId] = useState(() => createAssistantConversationId("admin"));
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "把当前后台页的 Provider、模型、任务或用户上下文挂进来，我会帮你做分析和配置建议。",
    },
  ]);

  useEffect(() => {
    let active = true;
    void api<AdminAssistantRuntimeStatus>("/api/admin/assistant/status").then((next) => active && setRuntime(next)).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const pageAttachments = useMemo(() => {
    const items: AssistantChatAttachment[] = [];
    if (activeTab === "providers") {
      providers.slice(0, 3).forEach((provider) => {
        if (!settings.allowProviderContext) return;
        items.push({
          id: `provider-${provider.id}`,
          kind: "provider",
          title: provider.name,
          summary: provider.baseUrl || "未填写 Base URL",
          payload: {
            id: provider.id,
            baseUrl: provider.baseUrl,
            protocol: provider.protocol,
            enabled: provider.enabled,
            status: provider.lastProbeStatus,
          },
        });
      });
      models.slice(0, 3).forEach((model) => {
        if (!settings.allowModelContext) return;
        items.push({
          id: `model-${model.id}`,
          kind: "model",
          title: model.displayName,
          summary: `${model.capability} / ${model.modelId}`,
          payload: {
            id: model.id,
            modelId: model.modelId,
            capability: model.capability,
            protocol: model.protocolOverride,
            enabled: model.enabled,
          },
        });
      });
    }
    if (activeTab === "tasks") {
      if (!settings.allowTaskContext) return items;
      tasks.slice(0, 4).forEach((task) => {
        items.push({
          id: `task-${task.id}`,
          kind: "task",
          title: task.title,
          summary: `${task.status} / ${task.modelId || "-"}`,
          payload: {
            id: task.id,
            status: task.status,
            modelId: task.modelId,
            providerId: task.providerId,
            updatedAt: task.updatedAt,
          },
        });
      });
    }
    if (activeTab === "users") {
      if (!settings.allowUserContext) return items;
      users.slice(0, 4).forEach((user) => {
        items.push({
          id: `user-${user.id}`,
          kind: "user",
          title: user.email,
          summary: `${user.role} / ${user.disabled ? "disabled" : "active"}`,
          payload: {
            id: user.id,
            role: user.role,
            disabled: user.disabled,
            updatedAt: user.updatedAt,
          },
        });
      });
    }
    if (activeTab === "audit") {
      if (!settings.allowAuditContext) return items;
      auditLogs.slice(0, 4).forEach((record) => {
        items.push({
          id: `audit-${record.id}`,
          kind: "audit",
          title: record.action,
          summary: record.summary,
          payload: {
            id: record.id,
            action: record.action,
            targetType: record.targetType,
            targetId: record.targetId,
            createdAt: record.createdAt,
          },
        });
      });
    }
    if (items.length === 0) {
      items.push({
        id: `page-${activeTab}`,
        kind: "page",
        title: "当前后台页面",
        summary: `tab=${activeTab}`,
        payload: { activeTab },
      });
    }
    return items;
  }, [activeTab, auditLogs, models, providers, settings.allowAuditContext, settings.allowModelContext, settings.allowProviderContext, settings.allowTaskContext, settings.allowUserContext, tasks, users]);

  useEffect(() => {
    const onAppend = (event: Event) => {
      const detail = (event as CustomEvent<AdminAssistantAppendContextDetail>).detail || {};
      const nextItems = Array.isArray(detail.attachments) ? detail.attachments : [];
      if (detail.open !== false) onOpenChange(true);
      if (typeof detail.message === "string" && detail.message.trim()) {
        setDraft(detail.message.trim());
      }
      if (nextItems.length === 0) return;
      setAttachments((current) => {
        const seen = new Set(current.map((item) => item.id || `${item.kind}-${item.title}-${item.summary}`));
        const merged = [...current];
        for (const item of nextItems) {
          const key = item.id || `${item.kind}-${item.title}-${item.summary}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(compactAssistantAttachment(item));
        }
        return merged;
      });
    };
    window.addEventListener(ADMIN_ASSISTANT_APPEND_CONTEXT_EVENT, onAppend);
    return () => window.removeEventListener(ADMIN_ASSISTANT_APPEND_CONTEXT_EVENT, onAppend);
  }, [onOpenChange]);

  function addAttachment(next: AssistantChatAttachment) {
    setAttachments((current) => {
      const exists = current.some((item) => item.id && next.id && item.id === next.id);
      if (exists) return current;
      return [...current, compactAssistantAttachment(next)];
    });
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    const outgoingAttachments = attachments.map(compactAssistantAttachment);
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: text || `请分析这 ${outgoingAttachments.length} 个后台上下文卡片。`,
      },
    ]);
    setDraft("");
    setAttachments([]);
    setBusy(true);
    setStatus("正在读取上下文");
    try {
      const assistantId = `assistant-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          text: "",
          mode: "fallback",
          streaming: true,
          process: [],
        },
      ]);
      const response = await fetch("/api/admin/assistant/chat/stream", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          attachments: outgoingAttachments,
          scope: "admin",
          conversationId: conversationId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const contentFilter = createAssistantContentStreamFilter();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const rawEvent = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          if (rawEvent) {
            const eventName = rawEvent.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
            const dataText = rawEvent
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("\n");
            const data = dataText ? JSON.parse(dataText) : null;
            if (eventName === "status" && typeof data?.status === "string") {
              setStatus(assistantPhaseLabel(data.status));
            }
            if (eventName === "delta" && typeof data?.delta === "string") {
              const delta = contentFilter.push(data.delta);
              if (!delta) {
                boundary = buffer.indexOf("\n\n");
                continue;
              }
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, text: `${message.text}${delta}` }
                    : message,
                ),
              );
            }
            if (eventName === "done" && data) {
              const result = data as AssistantChatResult;
              if (result.runtime) setRuntime(result.runtime);
              contentFilter.finish();
              const messageText = normalizeAssistantContent(result.content?.text || result.message);
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        text: messageText,
                        mode: result.mode,
                        streaming: false,
                      }
                    : message,
                ),
              );
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      setStatus("连接异常");
      setMessages((current) => [
        ...current.filter((message) => !message.streaming),
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: error instanceof Error ? error.message : String(error),
          mode: "fallback",
        },
      ]);
    } finally {
      setBusy(false);
      setStatus((current) => current === "连接异常" ? current : "就绪");
    }
  }

  function resetSession() {
    setConversationId(createAssistantConversationId("admin"));
    setDraft("");
    setAttachments([]);
    setStatus("就绪");
    setMessages([
      {
        id: `assistant-welcome-${Date.now()}`,
        role: "assistant",
        text: settings.hint,
      },
    ]);
  }

  async function handleUploadImage(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const uploaded = await api<{ url: string }>("/api/files/upload-base64", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl, prefix: "assistant-admin" }),
    });
    addAttachment({
      id: `admin-image-${Date.now()}`,
      kind: "image",
      title: file.name || "后台图片",
      summary: uploaded.url,
      payload: {
        kind: "image",
        url: uploaded.url,
        sourceUrl: uploaded.url,
      },
    });
  }

  return (
    <aside className={`admin-assistant-dock${open ? " admin-assistant-dock--open" : ""}`}>
      {open ? (
        <div className="admin-assistant-dock__panel">
          <header className="admin-assistant-dock__header">
            <div className="admin-assistant-dock__header-copy">
              <div className="admin-assistant-dock__eyebrow">
                <span className="admin-assistant-dock__eyebrow-badge">固定对话区</span>
                <span className="admin-assistant-dock__eyebrow-text">可挂当前页面的配置和状态上下文</span>
              </div>
              <strong>{settings.title || "后台 AI 助手"}</strong>
              <span>{runtime?.model?.modelDisplayName || "模型未就绪"} · {runtime?.routeStatus === "ready" ? "运行正常" : runtime?.routeStatus === "degraded" ? "路由降级" : "运行状态待确认"}{settings.hint ? ` · ${settings.hint}` : ""}</span>
            </div>
            <button type="button" className="icon-button" onClick={onToggle} title="关闭助手">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="admin-assistant-dock__session-bar">
            <div className="admin-assistant-dock__status">
              <span className="admin-assistant-dock__status-card">页面 <strong>{activeTab}</strong></span>
              <span className="admin-assistant-dock__status-card">可挂 <strong>{pageAttachments.length}</strong></span>
              <span className="admin-assistant-dock__status-card">已挂 <strong>{attachments.length}</strong></span>
            </div>
            <button type="button" onClick={resetSession} title="清空上下文并新建会话">
              <RotateCcw aria-hidden="true" />
              <span>新建会话</span>
            </button>
          </div>
          <details className="admin-assistant-dock__context">
            <summary className="admin-assistant-dock__section-head">
              <strong>添加当前页上下文</strong>
              <span>{pageAttachments.length} 项</span>
            </summary>
            <div className="admin-assistant-dock__quick-actions">
              {pageAttachments.slice(0, 6).map((item) => {
                const Icon =
                  item.kind === "provider"
                    ? KeyRound
                    : item.kind === "model"
                      ? Sparkles
                      : item.kind === "task"
                        ? Workflow
                        : item.kind === "audit"
                          ? ScrollText
                          : item.kind === "page"
                            ? MonitorCog
                            : UserCog;
                return (
                  <button key={item.id} type="button" onClick={() => addAttachment(item)}>
                    <span className="admin-assistant-dock__quick-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="admin-assistant-dock__quick-copy">
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </details>

          {attachments.length > 0 ? (
            <AssistantAttachmentStrip
              classPrefix="admin-assistant"
              items={attachments.map((item) => ({
                key: item.id || `${item.kind}-${item.title}`,
                kind: item.kind,
                title: item.title || item.kind || "上下文",
                kindLabel: getAttachmentKindLabel(item.kind),
                summary: item.summary,
              }))}
              onRemove={(key) => setAttachments((current) => current.filter((item) => (item.id || `${item.kind}-${item.title}`) !== key))}
            />
          ) : (
            <div className="admin-assistant-dock__empty">可直接提问，或展开上方添加当前页上下文。</div>
          )}

          <AssistantConversationList
            className="admin-assistant-dock__messages"
            classPrefix="admin-assistant"
            messages={messages}
            status={status}
            assistantLabel="后台 AI 助手"
          />

          <AssistantComposer
            classPrefix="admin-assistant"
            value={draft}
            placeholder={settings.placeholder}
            busy={busy}
            hasAttachments={attachments.length > 0}
            onCommit={setDraft}
            onUpload={handleUploadImage}
            onUploadError={(error) => setMessages((current) => [...current, {
              id: `assistant-upload-error-${Date.now()}`,
              role: "assistant",
              text: error instanceof Error ? error.message : String(error),
              mode: "fallback",
            }])}
            onSend={() => void sendMessage()}
          />
        </div>
      ) : null}
    </aside>
  );
}
