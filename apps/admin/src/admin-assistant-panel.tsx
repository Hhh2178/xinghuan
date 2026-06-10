import { Bot, ChevronLeft, ChevronRight, Image as ImageIcon, KeyRound, MonitorCog, RotateCcw, ScrollText, Send, Sparkles, UserCog, Workflow, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminUser,
  AssistantChatAttachment,
  AssistantChatResult,
  AssistantProcessEntry,
  AssistantSettings,
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
  mode?: "hermes" | "fallback";
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
  const [attachments, setAttachments] = useState<AssistantChatAttachment[]>([]);
  const [conversationId, setConversationId] = useState(() => createAssistantConversationId("admin"));
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "把当前后台页的 Provider、模型、任务或用户上下文挂进来，我会帮你做分析和配置建议。",
      mode: "fallback",
    },
  ]);

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
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
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
            if (eventName === "delta" && typeof data?.delta === "string") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, text: `${message.text}${data.delta}` }
                    : message,
                ),
              );
            }
            if (eventName === "done" && data) {
              const result = data as AssistantChatResult;
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        text: result.message,
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
    }
  }

  function resetSession() {
    setConversationId(createAssistantConversationId("admin"));
    setDraft("");
    setAttachments([]);
    setMessages([
      {
        id: `assistant-welcome-${Date.now()}`,
        role: "assistant",
        text: settings.hint,
        mode: "fallback",
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
      <button type="button" className="admin-assistant-dock__toggle" onClick={onToggle} title={open ? "收起 AI 助手" : "展开 AI 助手"}>
        {open ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
        <span>AI 助手</span>
      </button>

      {open ? (
        <div className="admin-assistant-dock__panel">
          <header className="admin-assistant-dock__header">
            <div className="admin-assistant-dock__header-copy">
              <div className="admin-assistant-dock__eyebrow">
                <span className="admin-assistant-dock__eyebrow-badge">固定对话区</span>
                <span className="admin-assistant-dock__eyebrow-text">可挂当前页面的配置和状态上下文</span>
              </div>
              <strong>{settings.title || "后台 AI 助手"}</strong>
              <span>{settings.hint}</span>
            </div>
            <button type="button" className="icon-button" onClick={onToggle} title="关闭助手">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="admin-assistant-dock__status">
            <div className="admin-assistant-dock__status-card">
              <span>当前页面</span>
              <strong>{activeTab}</strong>
            </div>
            <div className="admin-assistant-dock__status-card">
              <span>可挂上下文</span>
              <strong>{pageAttachments.length}</strong>
            </div>
            <div className="admin-assistant-dock__status-card">
              <span>已挂卡片</span>
              <strong>{attachments.length}</strong>
            </div>
          </div>
          <div className="admin-assistant-dock__session-bar">
            <span>当前对话</span>
            <button type="button" onClick={resetSession} title="清空上下文并新建会话">
              <RotateCcw aria-hidden="true" />
              <span>新建会话</span>
            </button>
          </div>
          <section className="admin-assistant-dock__context">
            <div className="admin-assistant-dock__section-head">
              <strong>当前可挂上下文</strong>
              <span>从当前后台页挑选需要一起分析的对象</span>
            </div>
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
          </section>

          {attachments.length > 0 ? (
            <div className="admin-assistant-dock__attachments">
              {attachments.map((item) => (
                <div key={item.id || `${item.kind}-${item.title}`} className="admin-assistant-attachment">
                  <div className="admin-assistant-attachment__meta">
                    <div className="admin-assistant-attachment__title-row">
                      <strong>{item.title || item.kind}</strong>
                      <span className="admin-assistant-attachment__badge">{getAttachmentKindLabel(item.kind)}</span>
                    </div>
                    <span>{item.summary}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((entry) => (entry.id || `${entry.kind}-${entry.title}`) !== (item.id || `${item.kind}-${item.title}`)),
                      )
                    }
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-assistant-dock__empty">先从上面选几条上下文卡片，再补一句你想分析的问题。当前也可以直接挂入 Provider、模型、任务或页面状态。</div>
          )}

          <div className="admin-assistant-dock__messages">
            {messages.map((message) => (
              <article key={message.id} className={`admin-assistant-message admin-assistant-message--${message.role}`}>
                <p>{message.text}</p>
              </article>
            ))}
          </div>

          <footer className="admin-assistant-dock__composer">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="admin-assistant-dock__file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                void handleUploadImage(file).catch((error) =>
                  setMessages((current) => [
                    ...current,
                    {
                      id: `assistant-upload-error-${Date.now()}`,
                      role: "assistant",
                      text: error instanceof Error ? error.message : String(error),
                      mode: "fallback",
                    },
                  ]),
                );
              }}
            />
            <div className="admin-assistant-dock__composer-actions">
              <button type="button" className="ghost-action" onClick={() => imageInputRef.current?.click()} disabled={busy}>
                <ImageIcon aria-hidden="true" />
                添加图片
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={settings.placeholder}
            />
            <button type="button" className="primary-action" onClick={() => void sendMessage()} disabled={busy || (!draft.trim() && attachments.length === 0)}>
              <Send aria-hidden="true" />
              {busy ? "发送中..." : "发送"}
            </button>
          </footer>
        </div>
      ) : null}
    </aside>
  );
}
