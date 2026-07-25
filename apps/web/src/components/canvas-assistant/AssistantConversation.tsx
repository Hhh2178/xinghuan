import { Bot, WandSparkles } from 'lucide-react';
import { AssistantConversationList } from '@xinghuan/ui';
import type { AssistantMessage } from './assistant-types';

export function AssistantConversation(props: {
  messages: AssistantMessage[];
  status: string;
  canAnalyzeFailure: boolean;
  failureAnalysisHint: string;
  onAnalyzeFailure: () => Promise<void>;
}) {
  if (props.messages.length === 0) {
    return (
      <div className="agent-assistant-empty">
        <Bot size={23} />
        <strong>画布协作助手</strong>
        <p>{props.failureAnalysisHint}</p>
        <button type="button" disabled={!props.canAnalyzeFailure} onClick={() => void props.onAnalyzeFailure()}><WandSparkles size={14} />分析节点报错原因</button>
      </div>
    );
  }
  return <AssistantConversationList messages={props.messages} status={props.status} assistantLabel="画布助手" classPrefix="agent-assistant" />;
}
