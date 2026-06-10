import { Bot, GripVertical, Image as ImageIcon, Minimize2, RotateCcw, Send, Video, Volume2, Workflow, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { getAssistantSettings, streamAssistantChat, type AssistantChatAttachment, type AssistantChatResult, type AssistantProcessEntry, type PublicAssistantSettings } from '../services/api';
import { uploadDataUrl } from '../services/imageOps';
import { getMediaItemsFromData } from '../utils/mediaCollection';

interface CanvasAssistantProps {
  nodes: Node[];
  edges: Edge[];
  activeCanvasId: string | null;
}

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode?: 'hermes' | 'fallback';
  streaming?: boolean;
  process?: AssistantProcessEntry[];
}

const DEFAULT_POSITION = { x: 24, y: 96 };
const PANEL_GAP = 12;
const PANEL_MIN_WIDTH = 320;
const PANEL_MIN_HEIGHT = 360;
const PANEL_DEFAULT_WIDTH = 388;
const PANEL_OFFSET_Y = 72;
const FRONTEND_ASSISTANT_TITLE = '画布 AI 助手';
const FRONTEND_ASSISTANT_PLACEHOLDER = '输入问题或要求';

const DEFAULT_SETTINGS: PublicAssistantSettings = {
  frontend: {
    enabled: true,
    title: FRONTEND_ASSISTANT_TITLE,
    hint: '',
    placeholder: FRONTEND_ASSISTANT_PLACEHOLDER,
    allowWorkflowAttachment: true,
    allowNodeAttachment: true,
    allowMediaAttachment: true,
    persistMemory: false,
  },
  integration: {
    kernel: 'fallback',
    endpoint: '',
    workspace: 'gray',
    model: 'hermes',
    profile: '',
    persistMemory: false,
    strictMode: true,
  },
  updatedAt: 0,
};

function getAttachmentKindLabel(kind: AssistantChatAttachment['kind']) {
  switch (kind) {
    case 'workflow':
      return '工作流';
    case 'node':
      return '节点';
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'audio':
      return '音频';
    default:
      return '上下文';
  }
}

function normalizeFrontendAssistantTitle(title: string) {
  const next = title.trim();
  if (!next) return FRONTEND_ASSISTANT_TITLE;
  if (next.includes('验收') || next.includes('测试') || next.includes('前端助手')) {
    return FRONTEND_ASSISTANT_TITLE;
  }
  return next;
}

function normalizeFrontendAssistantPlaceholder(placeholder: string) {
  const next = placeholder.trim();
  if (!next) return FRONTEND_ASSISTANT_PLACEHOLDER;
  if (next.includes('验收') || next.includes('例如：') || next.includes('为什么出图不稳定')) {
    return FRONTEND_ASSISTANT_PLACEHOLDER;
  }
  return next;
}

function createAssistantConversationId(scope: 'canvas' | 'admin') {
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function compactAssistantAttachment(item: AssistantChatAttachment): AssistantChatAttachment {
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  if (item.kind === 'workflow') {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      payload: {
        canvasId: typeof payload.canvasId === 'string' ? payload.canvasId : '',
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeTypes: nodes
          .slice(0, 12)
          .map((node) => (node && typeof node === 'object' && 'type' in node ? String(node.type || '') : ''))
          .filter(Boolean),
      },
    };
  }
  if (item.kind === 'node') {
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      payload: {
        id: typeof payload.id === 'string' ? payload.id : '',
        type: typeof payload.type === 'string' ? payload.type : String(payload.type || ''),
      },
    };
  }
  if (item.kind === 'image' || item.kind === 'video' || item.kind === 'audio') {
    const mediaUrl =
      typeof payload.url === 'string'
        ? payload.url
        : typeof payload.sourceUrl === 'string'
          ? payload.sourceUrl
          : '';
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      payload: {
        nodeId: typeof payload.nodeId === 'string' ? payload.nodeId : '',
        kind: item.kind,
        url: mediaUrl,
        sourceUrl: mediaUrl,
        urlHost: mediaUrl ? mediaUrl.replace(/^https?:\/\//, '').split('/')[0].slice(0, 120) : '',
      },
    };
  }
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    payload: {},
  };
}

export default function CanvasAssistant({ nodes, edges, activeCanvasId }: CanvasAssistantProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<PublicAssistantSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [attachments, setAttachments] = useState<AssistantChatAttachment[]>([]);
  const [conversationId, setConversationId] = useState(() => createAssistantConversationId('canvas'));
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const selectedNodes = useMemo(() => nodes.filter((node) => node.selected), [nodes]);
  const selectedMediaAttachments = useMemo(() => {
    const results: AssistantChatAttachment[] = [];
    for (const node of selectedNodes) {
      const images = getMediaItemsFromData(node.data, 'image');
      const videos = getMediaItemsFromData(node.data, 'video');
      const audios = getMediaItemsFromData(node.data, 'audio');
      images.slice(0, 3).forEach((item, index) => {
        if (!item.url) return;
        results.push({
          id: `${node.id}-image-${index}`,
          kind: 'image',
          title: item.name || '图片素材',
          summary: item.url,
          payload: { nodeId: node.id, url: item.url, kind: 'image' },
        });
      });
      videos.slice(0, 2).forEach((item, index) => {
        if (!item.url) return;
        results.push({
          id: `${node.id}-video-${index}`,
          kind: 'video',
          title: item.name || '视频素材',
          summary: item.url,
          payload: { nodeId: node.id, url: item.url, kind: 'video' },
        });
      });
      audios.slice(0, 2).forEach((item, index) => {
        if (!item.url) return;
        results.push({
          id: `${node.id}-audio-${index}`,
          kind: 'audio',
          title: item.name || '音频素材',
          summary: item.url,
          payload: { nodeId: node.id, url: item.url, kind: 'audio' },
        });
      });
    }
    return results;
  }, [selectedNodes]);

  const workflowAttachment = useMemo<AssistantChatAttachment | null>(() => {
    if (!selectedNodes.length || !activeCanvasId) return null;
    const idSet = new Set(selectedNodes.map((node) => node.id));
    const innerEdges = edges.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target));
    return {
      id: `workflow-${activeCanvasId}`,
      kind: 'workflow',
      title: `选中工作流 (${selectedNodes.length} 节点)`,
      summary: innerEdges.length ? `${selectedNodes.length} 节点 / ${innerEdges.length} 连线` : `${selectedNodes.length} 节点`,
      payload: {
        canvasId: activeCanvasId,
        nodes: selectedNodes.map((node) => ({
          id: node.id,
          type: String(node.type || ''),
        })),
        edges: innerEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        })),
      },
    };
  }, [activeCanvasId, edges, selectedNodes]);

  const nodeAttachment = useMemo<AssistantChatAttachment | null>(() => {
    if (selectedNodes.length !== 1) return null;
    const node = selectedNodes[0];
    return {
      id: `node-${node.id}`,
      kind: 'node',
      title: `节点 ${String(node.type || 'unknown')}`,
      summary: `ID ${node.id}`,
      payload: {
        id: node.id,
        type: node.type,
      },
    };
  }, [selectedNodes]);

  useEffect(() => {
    let cancelled = false;
    void getAssistantSettings()
      .then((next) => {
        if (cancelled) return;
        setSettings(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      setPosition({
        x: Math.max(12, Math.min(window.innerWidth - 84, event.clientX - dragOffsetRef.current.x)),
        y: Math.max(12, Math.min(window.innerHeight - 84, event.clientY - dragOffsetRef.current.y)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    const onAppend = (event: Event) => {
      const detail = (event as CustomEvent<{ attachments?: AssistantChatAttachment[]; open?: boolean }>).detail || {};
      const nextItems = Array.isArray(detail.attachments) ? detail.attachments : [];
      if (nextItems.length === 0) return;
      if (detail.open !== false) setOpen(true);
      setAttachments((current) => {
        const seen = new Set(current.map((item) => item.id || `${item.kind}-${item.title}-${item.summary}`));
        const merged = [...current];
        for (const item of nextItems) {
          const url =
            item.payload && typeof item.payload.url === 'string'
              ? item.payload.url.trim()
              : '';
          if ((item.kind === 'image' || item.kind === 'video' || item.kind === 'audio') && !url) continue;
          const key = item.id || `${item.kind}-${item.title}-${item.summary}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(compactAssistantAttachment(item));
        }
        return merged;
      });
    };
    window.addEventListener('penguin:append-assistant-context', onAppend);
    return () => window.removeEventListener('penguin:append-assistant-context', onAppend);
  }, []);

  const contextActions = useMemo(
    () => [
      settings.frontend.allowWorkflowAttachment && workflowAttachment ? { key: 'workflow', label: '发送选中工作流', icon: Workflow, attachment: workflowAttachment } : null,
      settings.frontend.allowNodeAttachment && nodeAttachment ? { key: 'node', label: '发送当前节点', icon: Bot, attachment: nodeAttachment } : null,
      ...(settings.frontend.allowMediaAttachment ? selectedMediaAttachments : []).map((attachment) => ({
        key: attachment.id || `${attachment.kind}-${attachment.title}`,
        label: attachment.title || '发送媒体',
        icon: attachment.kind === 'image' ? ImageIcon : attachment.kind === 'video' ? Video : Volume2,
        attachment,
      })),
    ].filter(Boolean) as Array<{ key: string; label: string; icon: typeof Bot; attachment: AssistantChatAttachment }>,
    [nodeAttachment, selectedMediaAttachments, settings.frontend.allowMediaAttachment, settings.frontend.allowNodeAttachment, settings.frontend.allowWorkflowAttachment, workflowAttachment],
  );

  const panelStyle = useMemo(() => {
    const fallbackLeft = position.x;
    const fallbackTop = position.y + PANEL_OFFSET_Y;
    if (typeof window === 'undefined') {
      return {
        left: fallbackLeft,
        top: fallbackTop,
        '--canvas-assistant-panel-left': `${fallbackLeft}px`,
        '--canvas-assistant-panel-top': `${fallbackTop}px`,
      } as CSSProperties;
    }
    const left = Math.max(PANEL_GAP, Math.min(position.x, window.innerWidth - PANEL_DEFAULT_WIDTH - PANEL_GAP));
    const top = Math.max(PANEL_GAP, Math.min(position.y + PANEL_OFFSET_Y, window.innerHeight - PANEL_MIN_HEIGHT - PANEL_GAP));
    return {
      left,
      top,
      '--canvas-assistant-panel-left': `${left}px`,
      '--canvas-assistant-panel-top': `${top}px`,
      '--canvas-assistant-panel-min-width': `${PANEL_MIN_WIDTH}px`,
      '--canvas-assistant-panel-min-height': `${PANEL_MIN_HEIGHT}px`,
    } as CSSProperties;
  }, [position.x, position.y]);

  const hasContextSection = contextActions.length > 0 || attachments.length > 0;
  const headerTitle = normalizeFrontendAssistantTitle(settings.frontend.title);
  const composerPlaceholder = normalizeFrontendAssistantPlaceholder(settings.frontend.placeholder);

  function addAttachment(next: AssistantChatAttachment) {
    setOpen(true);
    setAttachments((current) => {
      const exists = current.some((item) => item.id && next.id && item.id === next.id);
      if (exists) return current;
      const url =
        next.payload && typeof next.payload.url === 'string'
          ? next.payload.url.trim()
          : '';
      if ((next.kind === 'image' || next.kind === 'video' || next.kind === 'audio') && !url) {
        return current;
      }
      return [...current, compactAssistantAttachment(next)];
    });
  }

  async function sendMessage() {
    if (!settings.frontend.enabled) return;
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    const outgoingAttachments = attachments.map(compactAssistantAttachment);
    const userText = text || `请分析这 ${attachments.length} 个上下文卡片。`;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text: userText },
    ]);
    setDraft('');
    setAttachments([]);
    setBusy(true);
    try {
      const assistantId = `assistant-${Date.now()}`;
      setMessages((current) => [
        ...current,
        { id: assistantId, role: 'assistant', text: '', mode: 'fallback', streaming: true, process: [] },
      ]);
      await streamAssistantChat(
        {
          message: text,
          attachments: outgoingAttachments,
          scope: 'canvas',
          conversationId: conversationId,
        } as Parameters<typeof streamAssistantChat>[0] & { conversationId: string },
        {
          onDelta: (delta) =>
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, text: `${message.text}${delta}` } : message,
              ),
            ),
          onDone: (result: AssistantChatResult) =>
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, text: result.message, mode: result.mode, streaming: false }
                  : message,
              ),
            ),
        },
      );
    } catch (error) {
      setMessages((current) => [
        ...current.filter((message) => !message.streaming),
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: error instanceof Error ? error.message : String(error),
          mode: 'fallback',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadImage(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const uploadedUrl = await uploadDataUrl(dataUrl, 'assistant');
    addAttachment({
      id: `upload-image-${Date.now()}`,
      kind: 'image',
      title: file.name || '上传图片',
      summary: uploadedUrl,
      payload: {
        kind: 'image',
        url: uploadedUrl,
        sourceUrl: uploadedUrl,
      },
    });
  }

  function resetSession() {
    setDraft('');
    setAttachments([]);
    setMessages([]);
    setConversationId(createAssistantConversationId('canvas'));
    setOpen(false);
  }

  return (
    <>
      {settings.frontend.enabled ? (
      <div
        className={`canvas-assistant-fab${open ? ' canvas-assistant-fab--active' : ''}`}
        style={{ left: position.x, top: position.y }}
      >
        <button
          type="button"
          className="canvas-assistant-fab__drag"
          onPointerDown={(event) => {
            const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            dragOffsetRef.current = {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            };
            setDragging(true);
          }}
          title="拖动助手入口"
        >
          <GripVertical size={14} />
        </button>
        <button type="button" className="canvas-assistant-fab__main" onClick={() => setOpen((current) => !current)} title="打开 AI 助手">
          <Bot size={18} />
        </button>
      </div>
      ) : null}

      {settings.frontend.enabled && open ? (
        <section
          className="canvas-assistant-panel"
          style={panelStyle}
        >
          <div className="canvas-assistant-panel__resize" aria-hidden="true" />
          <header className="canvas-assistant-panel__header">
            <div className="canvas-assistant-panel__header-copy">
              <strong>{headerTitle}</strong>
            </div>
            <div className="canvas-assistant-panel__header-actions">
              <button type="button" onClick={resetSession} title="清空上下文并新建会话">
                <RotateCcw size={14} />
              </button>
              <button type="button" onClick={() => setOpen(false)} title="最小化">
                <Minimize2 size={14} />
              </button>
              <button type="button" onClick={() => setOpen(false)} title="关闭">
                <X size={14} />
              </button>
            </div>
          </header>

          <div className={`canvas-assistant-panel__context${hasContextSection ? '' : ' canvas-assistant-panel__context--empty'}`}>
            {hasContextSection ? (
              <>
              {contextActions.length > 0 ? (
                <div className="canvas-assistant-panel__context-actions">
                  {contextActions.slice(0, 6).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.key} type="button" onClick={() => addAttachment(item.attachment)} title={item.label}>
                        <span className="canvas-assistant-panel__context-action-icon">
                          <Icon size={13} />
                        </span>
                        <span className="canvas-assistant-panel__context-action-copy">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="canvas-assistant-panel__attachments">
                  {attachments.map((item) => {
                    const itemKey = item.id || `${item.kind}-${item.title}`;
                    const kindLabel = getAttachmentKindLabel(item.kind);
                    return (
                      <div key={itemKey} className="canvas-assistant-attachment">
                        <div className="canvas-assistant-attachment__meta">
                          <div className="canvas-assistant-attachment__title-row">
                            <strong>{item.title || item.kind}</strong>
                            <span className="canvas-assistant-attachment__badge">{kindLabel}</span>
                          </div>
                          <span className="canvas-assistant-attachment__summary">{item.summary || '已添加'}</span>
                        </div>
                        <button
                          type="button"
                          title={`移除${item.title || kindLabel}`}
                          onClick={() => setAttachments((current) => current.filter((entry) => (entry.id || `${entry.kind}-${entry.title}`) !== itemKey))}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              </>
            ) : null}
          </div>

          <div className="canvas-assistant-panel__messages">
            {messages.map((message) => (
              <article key={message.id} className={`canvas-assistant-message canvas-assistant-message--${message.role}`}>
                <p>{message.text}</p>
              </article>
            ))}
          </div>

          <footer className="canvas-assistant-panel__composer">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="canvas-assistant-panel__file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                void handleUploadImage(file).catch((error) =>
                  setMessages((current) => [
                    ...current,
                    {
                      id: `assistant-upload-error-${Date.now()}`,
                      role: 'assistant',
                      text: error instanceof Error ? error.message : String(error),
                      mode: 'fallback',
                    },
                  ]),
                );
              }}
            />
            <div className="canvas-assistant-panel__composer-actions">
              <button type="button" className="canvas-assistant-panel__attach" onClick={() => imageInputRef.current?.click()} disabled={busy}>
                <ImageIcon size={14} />
                <span>附加图片</span>
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={composerPlaceholder}
            />
            <button type="button" onClick={() => void sendMessage()} disabled={busy || (!draft.trim() && attachments.length === 0)}>
              <Send size={14} />
              <span>{busy ? '发送中...' : '发送'}</span>
            </button>
          </footer>
        </section>
      ) : null}
    </>
  );
}
