import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  getAssistantSettings,
  streamAssistantChat,
  type AssistantChatAttachment,
  type PublicAssistantSettings,
} from '../../services/api';
import { uploadDataUrl } from '../../services/imageOps';
import { getMediaItemsFromData } from '../../utils/mediaCollection';
import { attachmentKey, type AssistantMessage } from './assistant-types';

const DEFAULT_SETTINGS: PublicAssistantSettings = {
  frontend: {
    enabled: true,
    title: '画布协作助手',
    hint: '',
    placeholder: '描述目标、问题或下一步指令',
    allowWorkflowAttachment: true,
    allowNodeAttachment: true,
    allowMediaAttachment: true,
    persistMemory: false,
  },
  integration: {
    runtime: 'internal',
    assistantAgentKey: 'assistant-planner',
    providerAnalysisAgentKey: 'provider-analysis-planner',
    knowledgeProfile: 'public-canvas',
    persistMemory: false,
    strictMode: true,
  },
  updatedAt: 0,
};

function conversationId() {
  return `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function compact(item: AssistantChatAttachment): AssistantChatAttachment {
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  const url = typeof payload.url === 'string' ? payload.url : typeof payload.sourceUrl === 'string' ? payload.sourceUrl : '';
  if (item.kind === 'image' || item.kind === 'video' || item.kind === 'audio') {
    return { ...item, payload: { nodeId: payload.nodeId, kind: item.kind, url, sourceUrl: url } };
  }
  if (item.kind === 'workflow') {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    return { ...item, payload: { canvasId: payload.canvasId, nodeCount: nodes.length, edgeCount: edges.length, nodes, edges } };
  }
  return { ...item, payload };
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export function useAssistantSession(nodes: Node[], edges: Edge[], canvasId: string | null) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [attachments, setAttachments] = useState<AssistantChatAttachment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('就绪');
  const [sessionId, setSessionId] = useState(conversationId);
  const selected = useMemo(() => nodes.filter((node) => node.selected), [nodes]);

  useEffect(() => {
    let active = true;
    void getAssistantSettings().then((next) => active && setSettings(next)).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const suggestions = useMemo(() => {
    const items: AssistantChatAttachment[] = [];
    if (settings.frontend.allowWorkflowAttachment && selected.length > 0 && canvasId) {
      const ids = new Set(selected.map((node) => node.id));
      const selectedEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
      items.push({
        id: `workflow-${canvasId}`,
        kind: 'workflow',
        title: `选中工作流`,
        summary: `${selected.length} 节点 / ${selectedEdges.length} 连线`,
        payload: {
          canvasId,
          nodes: selected.map((node) => ({ id: node.id, type: String(node.type || '') })),
          edges: selectedEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
        },
      });
    }
    if (settings.frontend.allowNodeAttachment && selected.length === 1) {
      const node = selected[0];
      items.push({ id: `node-${node.id}`, kind: 'node', title: `节点 ${String(node.type || '')}`, summary: node.id, payload: { id: node.id, type: node.type } });
    }
    if (settings.frontend.allowMediaAttachment) {
      for (const node of selected) {
        for (const kind of ['image', 'video', 'audio'] as const) {
          getMediaItemsFromData(node.data, kind).slice(0, kind === 'image' ? 3 : 2).forEach((media, index) => {
            if (!media.url) return;
            items.push({ id: `${node.id}-${kind}-${index}`, kind, title: media.name || `${kind}素材`, summary: media.url, payload: { nodeId: node.id, url: media.url, kind } });
          });
        }
      }
    }
    return items;
  }, [canvasId, edges, selected, settings]);

  const addAttachment = useCallback((item: AssistantChatAttachment) => {
    const next = compact(item);
    setAttachments((current) => current.some((entry) => attachmentKey(entry) === attachmentKey(next)) ? current : [...current, next]);
  }, []);

  useEffect(() => {
    const append = (event: Event) => {
      const detail = (event as CustomEvent<{ attachments?: AssistantChatAttachment[] }>).detail;
      for (const item of detail?.attachments || []) addAttachment(item);
    };
    window.addEventListener('penguin:append-assistant-context', append);
    return () => window.removeEventListener('penguin:append-assistant-context', append);
  }, [addAttachment]);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('仅支持图片附件');
    const url = await uploadDataUrl(await fileToDataUrl(file), 'assistant');
    addAttachment({ id: `upload-${crypto.randomUUID()}`, kind: 'image', title: file.name || '粘贴图片', summary: url, payload: { kind: 'image', url, sourceUrl: url } });
  }, [addAttachment]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (busy || (!text && attachments.length === 0)) return;
    const outgoing = attachments.map(compact);
    const userText = text || `请分析这 ${outgoing.length} 个上下文。`;
    const assistantId = `assistant-${crypto.randomUUID()}`;
    setMessages((current) => [...current, { id: `user-${crypto.randomUUID()}`, role: 'user', text: userText }, { id: assistantId, role: 'assistant', text: '', streaming: true, process: [] }]);
    setDraft('');
    setAttachments([]);
    setBusy(true);
    setStatus('正在分析');
    try {
      await streamAssistantChat({ message: text, attachments: outgoing, scope: 'canvas', conversationId: sessionId, idempotencyKey: crypto.randomUUID() }, {
        onStatus: setStatus,
        onProcess: (entry) => setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, process: [...(message.process || []), entry] } : message)),
        onDelta: (delta) => setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: message.text + delta } : message)),
        onDone: (result) => setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: result.message, mode: result.mode, streaming: false } : message)),
      });
      setStatus('就绪');
    } catch (error) {
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: error instanceof Error ? error.message : String(error), mode: 'fallback', streaming: false } : message));
      setStatus('连接异常');
    } finally {
      setBusy(false);
    }
  }, [attachments, busy, draft, sessionId]);

  const reset = useCallback(() => {
    setMessages([]);
    setAttachments([]);
    setDraft('');
    setSessionId(conversationId());
    setStatus('就绪');
  }, []);

  return { settings, messages, attachments, suggestions, draft, setDraft, busy, status, addAttachment, setAttachments, uploadImage, send, reset };
}
