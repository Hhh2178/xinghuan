import { AssistantComposer as SharedAssistantComposer } from '@xinghuan/ui';

export function AssistantComposer(props: {
  value: string;
  placeholder: string;
  busy: boolean;
  hasAttachments: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onSend: () => void;
}) {
  return <SharedAssistantComposer {...props} onCommit={props.onChange} classPrefix="agent-assistant" />;
}
