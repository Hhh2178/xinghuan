import { FileImage, GitBranch, Image, Music2, Video, X } from 'lucide-react';
import type { AssistantChatAttachment } from '../../services/api';
import { attachmentKey, attachmentLabel } from './assistant-types';

const ICONS = { workflow: GitBranch, node: GitBranch, image: Image, video: Video, audio: Music2 };

export function AssistantAttachments({ items, onRemove }: { items: AssistantChatAttachment[]; onRemove: (key: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="agent-assistant-attachments" aria-label="待发送上下文">
      {items.map((item) => {
        const key = attachmentKey(item);
        const Icon = ICONS[item.kind as keyof typeof ICONS] || FileImage;
        return (
          <div className="agent-assistant-attachment" key={key}>
            <Icon size={14} />
            <span><strong>{item.title || attachmentLabel(item.kind)}</strong><small>{attachmentLabel(item.kind)}</small></span>
            <button type="button" onClick={() => onRemove(key)} title={`移除${item.title || '附件'}`}><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}
