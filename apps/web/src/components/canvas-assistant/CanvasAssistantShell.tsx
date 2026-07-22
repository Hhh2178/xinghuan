import { Bot, GitBranch, Minus, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { attachmentKey } from './assistant-types';
import { AssistantAttachments } from './AssistantAttachments';
import { AssistantComposer } from './AssistantComposer';
import { AssistantConversation } from './AssistantConversation';
import { useAssistantSession } from './useAssistantSession';
import { CanvasRunSupervisor } from '../canvas-agent/CanvasRunSupervisor';

export function CanvasAssistantShell({ nodes, edges, activeCanvasId }: { nodes: Node[]; edges: Edge[]; activeCanvasId: string | null }) {
  const session = useAssistantSession(nodes, edges, activeCanvasId);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'assistant' | 'run'>('assistant');
  const [initialRunId, setInitialRunId] = useState('');

  useEffect(() => {
    const openSupervisor = (event: Event) => {
      const detail = (event as CustomEvent<{ runId?: string }>).detail;
      setInitialRunId(detail?.runId || '');
      setView('run');
      setOpen(true);
    };
    const append = () => { setView('assistant'); setOpen(true); };
    window.addEventListener('penguin:open-run-supervisor', openSupervisor);
    window.addEventListener('penguin:append-assistant-context', append);
    return () => {
      window.removeEventListener('penguin:open-run-supervisor', openSupervisor);
      window.removeEventListener('penguin:append-assistant-context', append);
    };
  }, []);

  if (!session.settings.frontend.enabled) return null;
  return (
    <div className="agent-assistant-root" data-open={open ? 'true' : 'false'}>
      <button className="agent-assistant-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} title={open ? '收起画布助手' : '打开画布助手'}>
        <Sparkles size={18} /><span>AI</span>
      </button>
      {open ? (
        <aside className="agent-assistant-workbench" aria-label="画布 AI 工作台">
          <header className="agent-assistant-header">
            <div className="agent-assistant-header__title"><span><Bot size={17} /></span><div><strong>{session.settings.frontend.title || '画布协作助手'}</strong><small><i data-state={session.status === '就绪' ? 'ready' : 'working'} />{session.status}</small></div></div>
            <div className="agent-assistant-header__actions"><button type="button" onClick={session.reset} title="新建会话"><RotateCcw size={14} /></button><button type="button" onClick={() => setOpen(false)} title="最小化"><Minus size={15} /></button><button type="button" onClick={() => setOpen(false)} title="关闭"><X size={15} /></button></div>
          </header>
          <nav className="agent-assistant-tabs" aria-label="工作台视图">
            <button type="button" className={view === 'assistant' ? 'is-active' : ''} onClick={() => setView('assistant')}><Bot size={14} />协作</button>
            <button type="button" className={view === 'run' ? 'is-active' : ''} onClick={() => setView('run')}><GitBranch size={14} />托管</button>
          </nav>
          {view === 'assistant' ? (
            <>
              {session.suggestions.length > 0 ? <div className="agent-assistant-context-strip">{session.suggestions.slice(0, 6).map((item) => <button type="button" key={attachmentKey(item)} onClick={() => session.addAttachment(item)}>{item.title}<small>{item.summary}</small></button>)}</div> : null}
              <AssistantConversation messages={session.messages} status={session.status} />
              <div className="agent-assistant-compose-zone">
                <AssistantAttachments items={session.attachments} onRemove={(key) => session.setAttachments((current) => current.filter((item) => attachmentKey(item) !== key))} />
                <AssistantComposer value={session.draft} placeholder={session.settings.frontend.placeholder || '描述目标、问题或下一步指令'} busy={session.busy} hasAttachments={session.attachments.length > 0} onChange={session.setDraft} onUpload={session.uploadImage} onSend={() => void session.send()} />
              </div>
            </>
          ) : <CanvasRunSupervisor canvasId={activeCanvasId} initialRunId={initialRunId} />}
        </aside>
      ) : null}
    </div>
  );
}
