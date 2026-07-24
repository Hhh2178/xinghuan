import {
  createAssistantContent,
  createAssistantContentStreamFilter,
  type AssistantChatResult as SharedAssistantChatResult,
} from '@xinghuan/shared';

const BASE = '/api';

export interface AssistantChatAttachment {
  id?: string;
  kind?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

export interface AssistantChatResult extends SharedAssistantChatResult {}

export interface AssistantProcessEntry {
  label: string;
  content: string;
}

export interface PublicAssistantSettings {
  frontend: {
    enabled: boolean;
    title: string;
    hint: string;
    placeholder: string;
    allowWorkflowAttachment: boolean;
    allowNodeAttachment: boolean;
    allowMediaAttachment: boolean;
    persistMemory: false;
  };
  integration: {
    runtime: 'internal';
    frontendAssistantAgentKey: string;
    knowledgeProfile: string;
    persistMemory: false;
    strictMode: boolean;
  };
  updatedAt: number;
}

interface AssistantChatPayload {
  message?: string;
  attachments?: AssistantChatAttachment[];
  scope?: 'canvas' | 'admin';
  conversationId?: string;
  idempotencyKey?: string;
}

function normalizeAssistantChatResult(result: AssistantChatResult): AssistantChatResult {
  const content = createAssistantContent(result?.content?.text || result?.message || '');
  return { ...result, message: content.text, rawAssistant: content.text, content };
}

export async function chatWithAssistant(payload: AssistantChatPayload): Promise<AssistantChatResult> {
  const response = await fetch(`${BASE}/assistant/chat`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await readJson<{ success: boolean; data: AssistantChatResult }>(response);
  return normalizeAssistantChatResult(result.data);
}

export async function streamAssistantChat(
  payload: AssistantChatPayload,
  handlers: {
    onStatus?: (status: string) => void;
    onProcess?: (entry: AssistantProcessEntry) => void;
    onDelta?: (delta: string) => void;
    onDone?: (result: AssistantChatResult) => void;
  },
): Promise<void> {
  const response = await fetch(`${BASE}/assistant/chat/stream`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const contentFilter = createAssistantContentStreamFilter();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (rawEvent) dispatchEvent(rawEvent, contentFilter, handlers);
      boundary = buffer.indexOf('\n\n');
    }
  }
}

export async function getAssistantSettings(): Promise<PublicAssistantSettings> {
  const response = await fetch(`${BASE}/assistant/settings`, { credentials: 'same-origin' });
  const result = await readJson<{ success: boolean; data: PublicAssistantSettings }>(response);
  return result.data;
}

function dispatchEvent(
  rawEvent: string,
  contentFilter: ReturnType<typeof createAssistantContentStreamFilter>,
  handlers: {
    onStatus?: (status: string) => void;
    onProcess?: (entry: AssistantProcessEntry) => void;
    onDelta?: (delta: string) => void;
    onDone?: (result: AssistantChatResult) => void;
  },
) {
  const eventName = rawEvent.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
  const dataText = rawEvent.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  const data = dataText ? JSON.parse(dataText) : null;
  if (eventName === 'status' && typeof data?.status === 'string') handlers.onStatus?.(data.status);
  if (eventName === 'process' && typeof data?.label === 'string' && typeof data?.content === 'string') handlers.onProcess?.(data);
  if (eventName === 'delta' && typeof data?.delta === 'string') {
    const delta = contentFilter.push(data.delta);
    if (delta) handlers.onDelta?.(delta);
  }
  if (eventName === 'done' && data) {
    const tail = contentFilter.finish();
    if (tail) handlers.onDelta?.(tail);
    handlers.onDone?.(normalizeAssistantChatResult(data));
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  return JSON.parse(text) as T;
}
