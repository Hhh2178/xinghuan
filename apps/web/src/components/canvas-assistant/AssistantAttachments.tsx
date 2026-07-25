import { AssistantAttachmentStrip } from '@xinghuan/ui';
import type { AssistantChatAttachment } from '../../services/api';
import { attachmentKey, attachmentLabel } from './assistant-types';

export function AssistantAttachments({ items, onRemove }: { items: AssistantChatAttachment[]; onRemove: (key: string) => void }) {
  return (
    <AssistantAttachmentStrip
      classPrefix="agent-assistant"
      items={items.map((item) => ({
        key: attachmentKey(item),
        kind: item.kind,
        title: item.title || attachmentLabel(item.kind),
        kindLabel: attachmentLabel(item.kind),
        summary: item.summary,
      }))}
      onRemove={onRemove}
    />
  );
}
