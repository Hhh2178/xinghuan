import { describe, expect, it } from 'vitest';
import {
  buildStatelessLlmMessages,
  visibleLlmConversationTurns,
  type ChatTurn,
} from './llm-conversation-state';

describe('buildStatelessLlmMessages', () => {
  it('includes only the current turn and optional system prompt', () => {
    const result = buildStatelessLlmMessages({
      systemPrompt: 'You are concise.',
      userText: 'Describe the current image.',
      imageUrls: ['/api/shared-resources/items/current/content'],
      videoUrls: [],
    });

    expect(result).toEqual([
      { role: 'system', content: 'You are concise.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the current image.' },
          { type: 'image_url', image_url: { url: '/api/shared-resources/items/current/content' } },
        ],
      },
    ]);
    expect(result).not.toHaveLength(4);
  });

  it('does not accept or serialize historical turns', () => {
    const result = buildStatelessLlmMessages({
      systemPrompt: '',
      userText: 'Current request',
      imageUrls: [],
      videoUrls: [],
    });

    expect(result).toEqual([{ role: 'user', content: 'Current request' }]);
    expect(JSON.stringify(result)).not.toContain('old request');
    expect(JSON.stringify(result)).not.toContain('old answer');
  });
});

describe('visibleLlmConversationTurns', () => {
  const history: ChatTurn[] = [
    { role: 'user', text: 'old request', images: ['/files/input/old.png'] },
    { role: 'assistant', text: 'old answer' },
    { role: 'user', text: 'latest request' },
    { role: 'assistant', text: 'latest answer' },
  ];

  it('shows only the latest user turn by default while preserving source indexes', () => {
    expect(visibleLlmConversationTurns(history, false)).toEqual([
      { turn: history[2], historyIndex: 2 },
      { turn: history[3], historyIndex: 3 },
    ]);
  });

  it('shows the complete history when enabled', () => {
    expect(visibleLlmConversationTurns(history, true).map((item) => item.historyIndex)).toEqual([0, 1, 2, 3]);
  });

  it('keeps legacy assistant-only history visible when no user marker exists', () => {
    const legacy: ChatTurn[] = [{ role: 'assistant', text: 'legacy answer' }];
    expect(visibleLlmConversationTurns(legacy, false)).toEqual([{ turn: legacy[0], historyIndex: 0 }]);
  });
});
