import {
  Bot,
  Check,
  CheckCircle2,
  Copy,
  FileImage,
  GitBranch,
  Image,
  ImagePlus,
  LoaderCircle,
  Music2,
  SendHorizontal,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { AssistantMarkdown } from "./assistant-markdown.js";
import { isImeSubmissionEvent, useImeSafeTextControl } from "./ime-safe-text-control.js";

export interface AssistantConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "agent" | "fallback";
  streaming?: boolean;
  process?: Array<{ label: string; content: string }>;
}

export interface AssistantAttachmentItem {
  key: string;
  kind?: string;
  title: string;
  kindLabel: string;
  summary?: string;
}

const ASSISTANT_PHASE_LABELS: Record<string, string> = {
  idle: "就绪",
  ready: "就绪",
  starting: "正在读取上下文",
  "building-context": "正在分析",
  generating: "正在生成答复",
};

export function assistantPhaseLabel(status: string): string {
  const normalized = String(status || "").trim();
  return ASSISTANT_PHASE_LABELS[normalized] || normalized || "就绪";
}

export function AssistantConversationList(props: {
  messages: AssistantConversationMessage[];
  status: string;
  assistantLabel: string;
  classPrefix?: string;
  className?: string;
}) {
  const prefix = props.classPrefix || "xh-assistant";
  const status = assistantPhaseLabel(props.status);
  return (
    <div className={["xh-assistant-conversation", `${prefix}-conversation`, props.className].filter(Boolean).join(" ")} aria-live="polite">
      {props.messages.map((message) => (
        <article className={`xh-assistant-message ${prefix}-message ${prefix}-message--${message.role}`} key={message.id}>
          <div className={`xh-assistant-message__identity ${prefix}-message__identity`} data-role={message.role}>
            {message.role === "assistant" ? <Bot size={14} aria-label={props.assistantLabel} /> : <UserRound size={14} />}
            <span>{message.role === "assistant" ? props.assistantLabel : "你"}</span>
            {message.mode === "fallback" ? <small>受限模式</small> : null}
            {message.role === "assistant" && !message.streaming && message.text ? <CopyAnswerButton text={message.text} /> : null}
          </div>
          {message.process?.length ? (
            <details className={`xh-assistant-process ${prefix}-process`}>
              <summary><CheckCircle2 size={13} />已完成 {message.process.length} 个分析步骤</summary>
              {message.process.map((entry, index) => <p key={`${entry.label}-${index}`}><strong>{entry.label}</strong>{entry.content}</p>)}
            </details>
          ) : null}
          {message.text ? (
            <AssistantMarkdown className={`xh-assistant-message__body ${prefix}-message__body`} markdown={message.text} copyableBlocks={!message.streaming} />
          ) : null}
          {message.streaming ? <div className="xh-assistant-stream-status"><LoaderCircle size={14} /> <span>{status}</span></div> : null}
        </article>
      ))}
    </div>
  );
}

export function AssistantAttachmentStrip(props: {
  items: AssistantAttachmentItem[];
  onRemove: (key: string) => void;
  classPrefix?: string;
}) {
  if (props.items.length === 0) return null;
  const prefix = props.classPrefix || "xh-assistant";
  const icons = { workflow: GitBranch, node: GitBranch, image: Image, video: Video, audio: Music2 };
  return (
    <div className={`xh-assistant-attachments ${prefix}-attachments`} aria-label="待发送上下文">
      {props.items.map((item) => {
        const Icon = icons[item.kind as keyof typeof icons] || FileImage;
        return (
          <div className={`xh-assistant-attachment ${prefix}-attachment`} key={item.key}>
            <Icon size={14} />
            <span><strong>{item.title}</strong><small>{item.kindLabel}</small></span>
            <button type="button" onClick={() => props.onRemove(item.key)} title={`移除${item.title}`}><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

export function AssistantComposer(props: {
  value: string;
  placeholder: string;
  busy: boolean;
  hasAttachments: boolean;
  onCommit: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onUploadError?: (error: unknown) => void;
  onSend: () => void;
  classPrefix?: string;
}) {
  const prefix = props.classPrefix || "xh-assistant";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textControl = useImeSafeTextControl({ value: props.value, onCommit: props.onCommit });
  const upload = (file: File) => void props.onUpload(file).catch((error) => props.onUploadError?.(error));
  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isImeSubmissionEvent(event.nativeEvent, textControl.isComposing)) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    props.onSend();
  };
  const pasteImage = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    upload(file);
  };
  return (
    <div className={`xh-assistant-composer ${prefix}-composer`}>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) upload(file);
      }} />
      <textarea
        value={textControl.value}
        placeholder={props.placeholder}
        onChange={textControl.onChange}
        onCompositionStart={textControl.onCompositionStart}
        onCompositionEnd={textControl.onCompositionEnd}
        onKeyDown={sendOnEnter}
        onPaste={pasteImage}
        rows={3}
      />
      <div className={`xh-assistant-composer__actions ${prefix}-composer__actions`}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={props.busy} title="附加或粘贴图片"><ImagePlus size={16} /><span>添加图片</span></button>
        <button className={`xh-assistant-composer__send ${prefix}-composer__send`} type="button" onClick={props.onSend} disabled={props.busy || (!props.value.trim() && !props.hasAttachments)} title="发送指令">
          <SendHorizontal size={16} /><span>{props.busy ? "处理中" : "发送"}</span>
        </button>
      </div>
    </div>
  );
}

function CopyAnswerButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return <button type="button" onClick={() => void copy()} title={copied ? "已复制" : "复制回答"}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>;
}
