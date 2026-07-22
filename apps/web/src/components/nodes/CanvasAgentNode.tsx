import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, Play, ShieldCheck, Workflow } from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';

export interface CanvasAgentNodeData extends Record<string, unknown> {
  title?: string;
  scope?: 'canvas' | 'group' | 'downstream';
  policyRef?: string;
  agentRunId?: string;
}

function CanvasAgentNode({ id, data, selected }: NodeProps) {
  const update = useUpdateNodeData(id);
  const value = data as CanvasAgentNodeData;
  const scope = value.scope || 'canvas';
  return (
    <div className="canvas-agent-node" data-selected={selected ? 'true' : 'false'}>
      <Handle type="target" position={Position.Left} id="agent-in" />
      <Handle type="source" position={Position.Right} id="agent-out" />
      <header><span><Bot size={16} /></span><div><strong>{value.title || 'Agent 托管'}</strong><small>策略引用与运行入口</small></div><ShieldCheck size={15} /></header>
      <div className="canvas-agent-node__body">
        <label>监督范围<select value={scope} onChange={(event) => update({ scope: event.target.value })}><option value="canvas">全画布</option><option value="group">当前分组</option><option value="downstream">指定下游</option></select></label>
        <label>策略<input value={String(value.policyRef || 'default-production')} onChange={(event) => update({ policyRef: event.target.value })} /></label>
        <div className="canvas-agent-node__authority"><Workflow size={13} /><span>运行状态由服务端持久化</span></div>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('penguin:open-run-supervisor', { detail: { runId: value.agentRunId || '', nodeId: id } }))}><Play size={14} />打开托管面板</button>
      </div>
    </div>
  );
}

export default memo(CanvasAgentNode);
