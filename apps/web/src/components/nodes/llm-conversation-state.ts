import type { LlmContentPart, LlmMessage } from '../../services/generation';

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  videos?: string[];
};

export interface StatelessLlmMessageInput {
  systemPrompt: string;
  userText: string;
  imageUrls: string[];
  videoUrls: string[];
}

/** Builds the provider payload for one independent LLM execution. */
export function buildStatelessLlmMessages(input: StatelessLlmMessageInput): LlmMessage[] {
  const messages: LlmMessage[] = [];
  const systemPrompt = input.systemPrompt.trim();
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  const parts: LlmContentPart[] = [];
  const userText = input.userText.trim();
  if (userText) parts.push({ type: 'text', text: userText });
  for (const url of input.imageUrls) {
    if (url.trim()) parts.push({ type: 'image_url', image_url: { url } });
  }
  for (const url of input.videoUrls) {
    if (url.trim()) parts.push({ type: 'video_url', video_url: { url } });
  }

  messages.push({
    role: 'user',
    content: input.imageUrls.some((url) => url.trim()) || input.videoUrls.some((url) => url.trim()) ? parts : userText,
  });
  return messages;
}

export function visibleLlmConversationTurns(
  history: ChatTurn[],
  showHistory: boolean,
): Array<{ turn: ChatTurn; historyIndex: number }> {
  const startIndex = showHistory ? 0 : findLatestUserIndex(history);
  return history.slice(startIndex).map((turn, offset) => ({ turn, historyIndex: startIndex + offset }));
}

function findLatestUserIndex(history: ChatTurn[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.role === 'user') return index;
  }
  return Math.max(0, history.length - 1);
}
