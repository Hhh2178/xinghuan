import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { projectCanvasRunFailureDiagnostic, resolveNodeDisplayIdentity } from '@xinghuan/shared';
import { assistantPhaseLabel } from '@xinghuan/ui';
import {
  getAssistantSettings,
  streamAssistantChat,
  type AssistantChatAttachment,
  type PublicAssistantSettings,
} from '../../services/api';
import { uploadDataUrl } from '../../services/imageOps';
import { getMediaItemsFromData } from '../../utils/mediaCollection';
import { listCanvasWorkflowRuns, readCanvasRunEvents, type CanvasRunEvent } from '../canvas-agent/canvas-run-api';
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
    frontendAssistantAgentKey: 'assistant-planner',
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

function workflowAttachment(nodes: Node[], edges: Edge[], canvasId: string): AssistantChatAttachment {
  return {
    id: `workflow-${canvasId}`,
    kind: 'workflow',
    title: '当前画布',
    summary: `${nodes.length} 节点 / ${edges.length} 连线`,
    payload: {
      canvasId,
      nodes: nodes.slice(0, 40).map((node) => ({ id: node.id, type: String(node.type || ''), displayName: assistantNodeDisplayName(node), data: sanitizeAssistantWorkflowData(node.data) })),
      edges: edges.slice(0, 80).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    },
  };
}

export function sanitizeAssistantWorkflowData(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const allowed = new Set(['label', 'title', 'prompt', 'text', 'messages', 'backendProviderId', 'backendModelId', 'providerModel', 'taskCapability', 'groupOrder', 'skippedGroupIds', 'memberIds', 'generationAlternatives', 'agentQualityEvaluation', 'agentQualityProfileKey', 'agentSelectionPolicy', 'agentSelectionMaximum', 'agentParameterRepair', 'providerParams', 'size', 'ratio', 'aspectRatio']);
  return Object.fromEntries(Object.entries(source)
    .filter(([key]) => allowed.has(key) && !/key|secret|token|cookie|password|authorization/i.test(key))
    .map(([key, item]) => [key, workflowValue(item, 0)])
    .filter((entry): entry is [string, unknown] => entry[1] !== undefined));
}

function workflowValue(value: unknown, depth: number): unknown {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, 1200);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => workflowValue(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/key|secret|token|cookie|password|authorization/i.test(key))
    .slice(0, 20)
    .map(([key, item]) => [key.slice(0, 120), workflowValue(item, depth + 1)])
    .filter((entry): entry is [string, unknown] => entry[1] !== undefined));
  return undefined;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export function useAssistantSession(nodes: Node[], edges: Edge[], canvasId: string | null, assistantOpen: boolean) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [attachments, setAttachments] = useState<AssistantChatAttachment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('就绪');
  const [sessionId, setSessionId] = useState(conversationId);
  const [recentFailure, setRecentFailure] = useState<{ attachment: AssistantChatAttachment; label: string } | null>(null);
  const selected = useMemo(() => nodes.filter((node) => node.selected), [nodes]);
  const currentWorkflow = useMemo(() => canvasId ? workflowAttachment(nodes, edges, canvasId) : null, [canvasId, edges, nodes]);

  useEffect(() => {
    let active = true;
    void getAssistantSettings().then((next) => active && setSettings(next)).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRecentFailure(null);
    if (!assistantOpen || !canvasId || selected.length > 0) return () => { active = false; };
    void listCanvasWorkflowRuns(canvasId).then(async (runs) => {
      const failed = runs.filter((run) => run.status === 'failed').sort((left, right) => right.updatedAt - left.updatedAt)[0];
      if (!failed) return;
      const events = (await readCanvasRunEvents(failed.id)).items;
      const event = [...events].reverse().find(isAssistantFailureEvent);
      const step = failed.planSnapshot.steps.find((candidate) => candidate.id === event?.runStepKey
        || candidate.nodeId === event?.nodeId
        || candidate.id === event?.runStepId);
      if (!step || !active) return;
      const node = nodes.find((candidate) => candidate.id === step.nodeId);
      setRecentFailure(buildAssistantFailureTarget({
        node: node || { id: step.nodeId, type: step.nodeType, data: {} } as Node,
        edges,
        source: 'recent_failed_run',
        runId: failed.id,
        event,
        planContext: {
          groupId: step.groupId,
          groupOrder: failed.planSnapshot.groups.find((group) => group.id === step.groupId)?.order,
        },
      }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [assistantOpen, canvasId, edges, nodes, selected.length]);

  const selectedFailure = useMemo(() => selected[0] ? buildAssistantFailureTarget({
    node: selected[0],
    edges,
    source: 'selected_node',
  }) : null, [edges, selected]);
  const failureTarget = selectedFailure || recentFailure;

  const suggestions = useMemo(() => {
    const items: AssistantChatAttachment[] = [];
    if (settings.frontend.allowWorkflowAttachment && currentWorkflow) items.push(currentWorkflow);
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
          nodes: selected.map((node) => ({ id: node.id, type: String(node.type || ''), displayName: assistantNodeDisplayName(node) })),
          edges: selectedEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
        },
      });
    }
    if (settings.frontend.allowNodeAttachment && selected.length === 1) {
      const node = selected[0];
      const displayName = assistantNodeDisplayName(node);
      items.push({ id: `node-${node.id}`, kind: 'node', title: displayName, summary: String(node.type || '节点'), payload: { id: node.id, type: node.type, displayName } });
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
  }, [canvasId, currentWorkflow, edges, selected, settings]);

  const addAttachment = useCallback((item: AssistantChatAttachment) => {
    const next = compact(item);
    setAttachments((current) => current.some((entry) => attachmentKey(entry) === attachmentKey(next)) ? current : [...current, next]);
  }, []);

  useEffect(() => {
    const append = (event: Event) => {
      const detail = (event as CustomEvent<{ attachments?: AssistantChatAttachment[]; draft?: string }>).detail;
      for (const item of detail?.attachments || []) addAttachment(item);
      if (detail?.draft?.trim()) setDraft(detail.draft.trim());
    };
    window.addEventListener('penguin:append-assistant-context', append);
    return () => window.removeEventListener('penguin:append-assistant-context', append);
  }, [addAttachment]);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('仅支持图片附件');
    const url = await uploadDataUrl(await fileToDataUrl(file), 'assistant');
    addAttachment({ id: `upload-${crypto.randomUUID()}`, kind: 'image', title: file.name || '粘贴图片', summary: url, payload: { kind: 'image', url, sourceUrl: url } });
  }, [addAttachment]);

  const submit = useCallback(async (requestedText: string, requestedAttachments: AssistantChatAttachment[]) => {
    const text = requestedText.trim();
    if (busy || (!text && requestedAttachments.length === 0)) return;
    const outgoing = requestedAttachments.map(compact);
    if (currentWorkflow && !outgoing.some((item) => item.kind === 'workflow')) outgoing.unshift(compact(currentWorkflow));
    const userText = text || `请分析这 ${outgoing.length} 个上下文。`;
    const assistantId = `assistant-${crypto.randomUUID()}`;
    setMessages((current) => [...current, { id: `user-${crypto.randomUUID()}`, role: 'user', text: userText }, { id: assistantId, role: 'assistant', text: '', streaming: true, process: [] }]);
    setDraft('');
    setAttachments([]);
    setBusy(true);
    setStatus('正在分析');
    try {
      await streamAssistantChat({ message: text, attachments: outgoing, scope: 'canvas', conversationId: sessionId, idempotencyKey: crypto.randomUUID() }, {
        onStatus: (nextStatus) => setStatus(assistantPhaseLabel(nextStatus)),
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
  }, [busy, currentWorkflow, sessionId]);

  const send = useCallback(async () => {
    await submit(draft, attachments);
  }, [attachments, draft, submit]);

  const analyzeFailure = useCallback(async () => {
    if (!failureTarget) return;
    await submit(`分析${failureTarget.label}的报错原因，并按“发生了什么、为什么发生、影响了哪些步骤、现在怎么修复”给出结论。`, [failureTarget.attachment]);
  }, [failureTarget, submit]);

  const reset = useCallback(() => {
    setMessages([]);
    setAttachments([]);
    setDraft('');
    setSessionId(conversationId());
    setStatus('就绪');
  }, []);

  return {
    settings,
    messages,
    attachments,
    suggestions,
    draft,
    setDraft,
    busy,
    status,
    addAttachment,
    setAttachments,
    uploadImage,
    send,
    reset,
    analyzeFailure,
    canAnalyzeFailure: Boolean(failureTarget),
    failureAnalysisHint: failureTarget ? failureTarget.label : '请先选择节点或打开失败运行',
  };
}

export function buildAssistantFailureTarget(input: {
  node: Node;
  edges: Edge[];
  source: 'selected_node' | 'recent_failed_run';
  runId?: string;
  event?: CanvasRunEvent;
  planContext?: { groupId?: string | null; groupOrder?: number; layer?: number };
}) {
  const incoming = input.edges.filter((edge) => edge.target === input.node.id).map((edge) => edge.source).slice(0, 20);
  const outgoing = input.edges.filter((edge) => edge.source === input.node.id).map((edge) => edge.target).slice(0, 20);
  const diagnostic = input.event ? projectCanvasRunFailureDiagnostic({
    code: input.event.payload.code || input.event.payload.failureClass,
    eventType: input.event.eventType,
    message: input.event.payload.message || input.event.payload.error,
    reason: input.event.payload.reason,
    failureCategory: input.event.payload.failureCategory,
    providerDiagnostic: input.event.payload.providerDiagnostic,
    waitReason: input.event.payload.waitReason,
    runId: input.runId,
    runStepId: input.event.runStepKey || input.event.runStepId,
    nodeId: input.node.id,
    nodeType: String(input.node.type || ''),
    providerName: input.event.payload.providerName,
    modelName: input.event.payload.modelName,
    taskId: input.event.payload.taskId,
    requestId: input.event.payload.requestId,
    upstreamHttpStatus: input.event.payload.upstreamHttpStatus,
  }) : undefined;
  const displayName = assistantNodeDisplayName(input.node);
  const attachment: AssistantChatAttachment = {
    id: `failure-${input.source}-${input.runId || input.node.id}`,
    kind: 'node',
    title: displayName,
    summary: String(input.node.type || '节点'),
    payload: {
      source: input.source,
      runId: input.runId,
      nodeId: input.node.id,
      nodeType: String(input.node.type || ''),
      displayName,
      configuration: sanitizeAssistantWorkflowData(input.node.data),
      upstreamNodeIds: incoming,
      downstreamNodeIds: outgoing,
      planContext: input.planContext,
      diagnostic,
    },
  };
  return { attachment, label: displayName };
}

export function isAssistantFailureEvent(event: CanvasRunEvent) {
  return /(?:failed|model_unavailable|budget_exceeded)$/.test(event.eventType)
    || event.payload.status === 'failed';
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function assistantNodeDisplayName(node: Node) {
  const data = node.data && typeof node.data === 'object' ? node.data as Record<string, unknown> : {};
  const nodeType = String(node.type || '节点');
  return resolveNodeDisplayIdentity({
    nodeId: node.id,
    nodeType,
    customLabel: data.label || data.title,
    catalogLabel: nodeType,
  }).displayName;
}
