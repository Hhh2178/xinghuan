import { memo, useMemo, useState } from 'react';
import { useReactFlow, type NodeProps } from '@xyflow/react';
import { Braces, Crosshair, Plus, Trash2, Workflow } from 'lucide-react';
import { collectWorkflowVariableReferences, type WorkflowVariableType } from '@xinghuan/shared';

import { getNodeSerialId } from '../../utils/nodeSerialIds';
import { useCanvasWorkflows } from '../canvas/CanvasWorkflowContext';
import { WorkflowMembershipControl, WorkflowVariableValues } from '../canvas/WorkflowVariableControls';
import { workflowVariableErrorMessage } from '../canvas/workflowTokenPresentation';

const VARIABLE_TYPES: Array<{ value: WorkflowVariableType; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'image', label: '图像' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'number', label: '数字' },
  { value: 'select', label: '选项' },
];

function WorkflowVariablesNode({ id, selected }: NodeProps) {
  const controller = useCanvasWorkflows();
  const reactFlow = useReactFlow();
  const workflow = controller.workflowForNode(id);
  const [newType, setNewType] = useState<WorkflowVariableType>('text');
  const [message, setMessage] = useState('');
  const references = useMemo(() => workflow ? collectWorkflowVariableReferences(workflow) : {}, [workflow]);
  const nodesById = useMemo(() => new Map(reactFlow.getNodes().map((node) => [node.id, node])), [reactFlow, workflow]);

  const focusNode = (nodeId: string) => {
    const target = reactFlow.getNode(nodeId);
    if (!target) return;
    reactFlow.setNodes((nodes) => nodes.map((node) => ({ ...node, selected: node.id === nodeId })));
    void reactFlow.fitView({ nodes: [target], duration: 420, padding: 0.35 });
  };

  const removeVariable = (variableId: string) => {
    if (!controller.removeVariable(workflow?.id || '', variableId)) {
      setMessage('变量仍被节点引用，无法删除');
      return;
    }
    setMessage('');
  };

  return (
    <div
      className={`relative flex w-[340px] flex-col overflow-hidden rounded-lg border-2 bg-zinc-950/95 text-white shadow-2xl ${selected ? 'border-amber-300' : 'border-white/15'}`}
    >
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-300/15 text-amber-200"><Braces size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">工作流变量</div>
          <div className="truncate text-[10px] text-white/40">{workflow ? `${workflow.name} · r${workflow.revision}` : '未归属工作流'}</div>
        </div>
        <Workflow size={14} className="text-white/35" />
      </div>

      <div className="nodrag nowheel max-h-[520px] space-y-3 overflow-auto p-3" onMouseDown={(event) => event.stopPropagation()}>
        <WorkflowMembershipControl
          nodeId={id}
          workflow={workflow}
          validateAssignment={(workflowId) => reactFlow.getNodes().some((node) => (
            node.id !== id
            && node.type === 'workflow-variables'
            && controller.workflowForNode(node.id)?.id === workflowId
          )) ? '每个工作流只能有一个变量汇总节点' : null}
          onValidationError={setMessage}
        />
        {workflow ? (
          <>
            <div className="flex gap-1.5">
              <select value={newType} onChange={(event) => setNewType(event.target.value as WorkflowVariableType)} className="h-8 min-w-0 flex-1 rounded border border-white/10 bg-zinc-900 px-2 text-[11px] outline-none">
                {VARIABLE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <button type="button" onClick={() => controller.addVariable(workflow.id, newType)} className="inline-flex h-8 items-center gap-1 rounded bg-amber-300 px-2 text-[11px] font-semibold text-zinc-950">
                <Plus size={12} />新增
              </button>
            </div>

            {workflow.variables.length === 0 ? (
              <div className="border-y border-white/10 py-5 text-center text-xs text-white/35">暂无变量</div>
            ) : workflow.variables.map((variable) => {
              const nodeIds = references[variable.id] || [];
              return (
                <div key={variable.id} className="space-y-2 border-t border-white/10 pt-2 first:border-t-0">
                  <div className="flex items-center gap-2">
                    <input
                      value={variable.label}
                      onChange={(event) => {
                        const error = controller.updateVariable(workflow.id, variable.id, { key: event.target.value, label: event.target.value });
                        setMessage(workflowVariableErrorMessage(error) || '');
                      }}
                      className="h-7 min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 text-[11px] font-medium outline-none focus:border-amber-300/60"
                      aria-label={`${variable.label}变量名称`}
                    />
                    <span className="text-[10px] text-white/40">{variable.type}</span>
                    <button type="button" onClick={() => removeVariable(variable.id)} className="inline-flex h-7 w-7 items-center justify-center rounded text-white/40 hover:bg-red-500/15 hover:text-red-300" title="删除变量">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <WorkflowVariableValues workflow={workflow} variableIds={[variable.id]} />
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/40">
                    <span>引用</span>
                    {nodeIds.length === 0 ? <span>0</span> : nodeIds.map((nodeId) => {
                      const serial = getNodeSerialId(nodesById.get(nodeId));
                      return (
                        <button key={nodeId} type="button" onClick={() => focusNode(nodeId)} className="inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 text-amber-200 hover:bg-white/10" title={`定位节点 ${serial ? `#${serial}` : nodeId}`}>
                          <Crosshair size={10} />{serial ? `#${serial}` : nodeId.slice(0, 8)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
        {message ? <div className="text-[10px] text-red-300">{message}</div> : null}
      </div>
    </div>
  );
}

export default memo(WorkflowVariablesNode);
