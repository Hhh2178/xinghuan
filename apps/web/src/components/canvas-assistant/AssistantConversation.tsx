import { Bot, Check, CheckCircle2, Copy, LoaderCircle, UserRound, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { AssistantMarkdown } from '@xinghuan/ui';
import type { AssistantMessage } from './assistant-types';

export function AssistantConversation(props: {
  messages: AssistantMessage[];
  status: string;
  canAnalyzeFailure: boolean;
  failureAnalysisHint: string;
  onAnalyzeFailure: () => Promise<void>;
}) {
  const { messages, status } = props;
  if (messages.length === 0) {
    return (
      <div className="agent-assistant-empty">
        <Bot size={23} />
        <strong>画布协作助手</strong>
        <p>{props.failureAnalysisHint}</p>
        <button type="button" disabled={!props.canAnalyzeFailure} onClick={() => void props.onAnalyzeFailure()}><WandSparkles size={14} />分析节点报错原因</button>
      </div>
    );
  }
  return (
    <div className="agent-assistant-conversation" aria-live="polite">
      {messages.map((message) => (
        <article className={`agent-assistant-message agent-assistant-message--${message.role}`} key={message.id}>
          <div className="agent-assistant-message__identity" data-role={message.role}>
            {message.role === 'assistant' ? <Bot size={14} aria-label="画布助手" /> : <UserRound size={14} />}
            {message.role === 'user' ? <span>你</span> : null}
            {message.mode === 'fallback' ? <small>受限模式</small> : null}
            {message.role === 'assistant' && !message.streaming && message.text ? <CopyAnswerButton text={message.text} /> : null}
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
            copyableBlocks={!message.streaming}
          />
          {message.streaming ? <LoaderCircle className="agent-assistant-spin" size={14} /> : null}
        </article>
      ))}
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
  return <button type="button" onClick={() => void copy()} title={copied ? '已复制' : '复制整条回答'} aria-label={copied ? '已复制' : '复制整条回答'}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>;
}
