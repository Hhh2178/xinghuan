import { ImagePlus, SendHorizontal } from 'lucide-react';
import { useRef } from 'react';
import { isImeSubmissionEvent, useImeSafeTextControl } from '../inputs/useImeSafeTextControl';

export function AssistantComposer(props: {
  value: string;
  placeholder: string;
  busy: boolean;
  hasAttachments: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onSend: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textControl = useImeSafeTextControl({ value: props.value, onCommit: props.onChange });
  const sendOnEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isImeSubmissionEvent(event.nativeEvent, textControl.isComposing)) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      props.onSend();
    }
  };
  const pasteImage = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    void props.onUpload(file);
  };
  return (
    <div className="agent-assistant-composer">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void props.onUpload(file);
      }} />
      <textarea
        value={textControl.value}
        placeholder={props.placeholder}
        onChange={textControl.onChange}
        onCompositionStart={textControl.onCompositionStart}
        onCompositionEnd={textControl.onCompositionEnd}
        onKeyDown={sendOnEnter}
        onPaste={pasteImage}
        rows={3}
      />
      <div className="agent-assistant-composer__actions">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={props.busy} title="附加或粘贴图片"><ImagePlus size={16} /><span>图片</span></button>
        <button className="agent-assistant-composer__send" type="button" onClick={props.onSend} disabled={props.busy || (!props.value.trim() && !props.hasAttachments)} title="发送指令">
          <SendHorizontal size={16} /><span>{props.busy ? '处理中' : '发送'}</span>
        </button>
      </div>
    </div>
  );
}
