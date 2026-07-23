import { Bot, CheckCircle2, LoaderCircle, UserRound } from 'lucide-react';
import { AssistantMarkdown } from '@xinghuan/ui';
import type { AssistantMessage } from './assistant-types';

export function AssistantConversation({ messages, status }: { messages: AssistantMessage[]; status: string }) {
  if (messages.length === 0) {
    return (
      <div className="agent-assistant-empty">
        <Bot size={23} />
        <strong>从当前画布开始</strong>
        <p>选中节点或素材后，可让助手解释连接、分析质量、检查配置或准备托管运行。</p>
      </div>
    );
  }
  return (
    <div className="agent-assistant-conversation" aria-live="polite">
      {messages.map((message) => (
        <article className={`agent-assistant-message agent-assistant-message--${message.role}`} key={message.id}>
          <div className="agent-assistant-message__identity">
            {message.role === 'assistant' ? <Bot size={14} /> : <UserRound size={14} />}
            <span>{message.role === 'assistant' ? '画布助手' : '你'}</span>
            {message.mode === 'fallback' ? <small>受限模式</small> : null}
          </div>
          {message.process?.length ? (
            <details className="agent-assistant-process">
              <summary><CheckCircle2 size={13} /> 已完成 {message.process.length} 个分析步骤</summary>
              {message.process.map((entry, index) => <p key={`${entry.label}-${index}`}><strong>{entry.label}</strong>{entry.content}</p>)}
            </details>
          ) : null}
          <AssistantMarkdown
            className="agent-assistant-message__body"
            markdown={message.text || (message.streaming ? status : '')}
          />
          {message.streaming ? <LoaderCircle className="agent-assistant-spin" size={14} /> : null}
        </article>
      ))}
    </div>
  );
}
