import type { AssistantChatAttachment, AssistantProcessEntry } from '../../services/api';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode?: 'agent' | 'fallback';
  streaming?: boolean;
  process?: AssistantProcessEntry[];
}

export function attachmentKey(item: AssistantChatAttachment) {
  return item.id || `${item.kind}-${item.title}-${item.summary}`;
}

export function attachmentLabel(kind?: string) {
  return { workflow: '工作流', node: '节点', image: '图片', video: '视频', audio: '音频' }[kind || ''] || '上下文';
}
