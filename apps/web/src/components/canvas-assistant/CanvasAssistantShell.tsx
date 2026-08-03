import { Bot, Layers3, Minus, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { attachmentKey } from './assistant-types';
import { AssistantAttachments } from './AssistantAttachments';
import { AssistantComposer } from './AssistantComposer';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantSession } from './useAssistantSession';
import { useAssistantGeometry } from './useAssistantGeometry';

export function CanvasAssistantShell({ nodes, edges, activeCanvasId, ownerId }: { nodes: Node[]; edges: Edge[]; activeCanvasId: string | null; ownerId: string }) {
  const [open, setOpen] = useState(false);
  const session = useAssistantSession(nodes, edges, activeCanvasId, open);
  const [contextOpen, setContextOpen] = useState(false);
  const geometry = useAssistantGeometry(ownerId, open);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('penguin:assistant-open-change', { detail: { open, compact: geometry.layout.compact } }));
  }, [geometry.layout.compact, open]);

  useEffect(() => {
    const handleSupervision = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (geometry.layout.compact && detail?.open) setOpen(false);
    };
    window.addEventListener('penguin:supervision-open-change', handleSupervision);
    return () => window.removeEventListener('penguin:supervision-open-change', handleSupervision);
  }, [geometry.layout.compact]);

  useEffect(() => {
    const handleAssistantContext = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (detail?.open) setOpen(true);
    };
    window.addEventListener('penguin:append-assistant-context', handleAssistantContext);
    return () => window.removeEventListener('penguin:append-assistant-context', handleAssistantContext);
  }, []);

  if (!session.settings.frontend.enabled) return null;
  return (
    <div
      className="agent-assistant-root"
      data-open={open ? 'true' : 'false'}
      data-side={geometry.layout.effectiveSide}
      data-compact={geometry.layout.compact ? 'true' : 'false'}
      style={{ left: geometry.layout.launcher.x, top: geometry.layout.launcher.y }}
    >
      {open && geometry.layout.compact ? <button className="agent-assistant-backdrop" type="button" aria-label="收起画布助手" onClick={() => setOpen(false)} /> : null}
      <button
        className="agent-assistant-launcher"
        type="button"
        onPointerDown={geometry.beginLauncherDrag}
        onPointerMove={geometry.moveDrag}
        onPointerUp={geometry.endDrag}
        onPointerCancel={geometry.endDrag}
        onClick={() => { if (!geometry.consumeLauncherClick()) setOpen((value) => !value); }}
        aria-expanded={open}
        title={open ? '收起画布助手' : '打开画布助手'}
      >
        <Sparkles size={18} /><span>AI</span>
      </button>
      {open ? (
        <aside
          ref={geometry.panelRef}
          className="agent-assistant-workbench"
          aria-label="画布 AI 工作台"
          data-compact={geometry.layout.compact ? 'true' : 'false'}
          style={{
            left: geometry.layout.panel.x,
            top: geometry.layout.panel.y,
            width: geometry.layout.panel.width,
            height: geometry.layout.panel.height,
          }}
        >
          <header
            className="agent-assistant-header"
            onPointerDown={geometry.beginPanelDrag}
            onPointerMove={geometry.moveDrag}
            onPointerUp={geometry.endDrag}
            onPointerCancel={geometry.endDrag}
          >
            <div className="agent-assistant-header__title"><span><Bot size={17} /></span><div><strong>{session.settings.frontend.title || '画布协作助手'}</strong><small><i data-state={session.status === '就绪' ? 'ready' : 'working'} />{session.runtime?.model?.modelDisplayName || '模型未就绪'} · {session.status}</small></div></div>
            <div className="agent-assistant-header__actions"><button type="button" onClick={session.reset} title="新建会话"><RotateCcw size={14} /></button><button type="button" onClick={() => setOpen(false)} title="最小化"><Minus size={15} /></button><button type="button" onClick={() => { session.reset(); setOpen(false); }} title="关闭并清空会话"><X size={15} /></button></div>
          </header>
          <AssistantConversation
            messages={session.messages}
            status={session.status}
            canAnalyzeFailure={session.canAnalyzeFailure}
            failureAnalysisHint={session.failureAnalysisHint}
            onAnalyzeFailure={session.analyzeFailure}
          />
          <div className="agent-assistant-compose-zone">
            {session.suggestions.length > 0 ? <div className="agent-assistant-context-picker">
              <button type="button" aria-expanded={contextOpen} onClick={() => setContextOpen((value) => !value)} title="添加画布上下文"><Layers3 size={13} /><span>上下文</span><small>{session.attachments.length}</small></button>
              {contextOpen ? <div role="menu">{session.suggestions.slice(0, 6).map((item) => <button type="button" role="menuitem" key={attachmentKey(item)} onClick={() => { session.addAttachment(item); setContextOpen(false); }}><strong>{item.title}</strong><small>{item.summary}</small></button>)}</div> : null}
            </div> : null}
            <AssistantAttachments items={session.attachments} onRemove={(key) => session.setAttachments((current) => current.filter((item) => attachmentKey(item) !== key))} />
            <AssistantComposer value={session.draft} placeholder={session.settings.frontend.placeholder || '描述目标、问题或下一步指令'} busy={session.busy} hasAttachments={session.attachments.length > 0} onChange={session.setDraft} onUpload={session.uploadImage} onSend={() => void session.send()} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
