import { Plus, Workflow } from 'lucide-react';
import type { WorkflowDocument, WorkflowVariableDefinition } from '@xinghuan/shared';

import { useCanvasWorkflows } from './CanvasWorkflowContext';

export function WorkflowMembershipControl({
  nodeId,
  workflow,
  validateAssignment,
  onValidationError,
}: {
  nodeId: string;
  workflow?: WorkflowDocument;
  validateAssignment?: (workflowId: string) => string | null;
  onValidationError?: (message: string) => void;
}) {
  const controller = useCanvasWorkflows();
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-medium text-white/55">归属工作流</label>
      <div className="flex gap-1.5">
        <select
          value={workflow?.id || ''}
          onChange={(event) => {
            const workflowId = event.target.value;
            const error = workflowId ? validateAssignment?.(workflowId) : null;
            if (error) {
              onValidationError?.(error);
              return;
            }
            onValidationError?.('');
            const assignmentError = controller.assignNode(nodeId, workflowId || null);
            if (assignmentError) {
              const message = assignmentError === 'WORKFLOW_REGION_OVERLAP'
                ? '加入后工作流区域会与其他区域重叠，请先移动节点或调整区域'
                : '无法更新工作流归属';
              if (onValidationError) onValidationError(message);
              else alert(message);
            }
          }}
          className="h-7 min-w-0 flex-1 rounded border border-white/10 bg-zinc-900 px-1.5 text-[10px] text-white outline-none focus:border-amber-300/60 nodrag nowheel"
        >
          <option value="">未归属</option>
          {controller.workflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!controller.createWorkflowForNode(nodeId)) {
              const message = '新工作流区域会与已有区域重叠，请先移动节点或调整区域';
              if (onValidationError) onValidationError(message);
              else alert(message);
            }
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          title="新建工作流并加入当前节点"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export function WorkflowVariableValues({ workflow, variableIds }: { workflow: WorkflowDocument; variableIds: string[] }) {
  const controller = useCanvasWorkflows();
  const variables = variableIds
    .map((id) => workflow.variables.find((variable) => variable.id === id))
    .filter((variable): variable is WorkflowVariableDefinition => Boolean(variable));
  if (variables.length === 0) return null;
  return (
    <div className="space-y-1.5 border-t border-white/10 pt-2">
      {variables.map((variable) => (
        <label key={variable.id} className="block space-y-1">
          <span className="flex items-center gap-1 text-[10px] text-white/55">
            <span className="rounded-sm bg-amber-300 px-1 font-semibold text-zinc-950">{variable.key}</span>
            <span>{variable.type}</span>
            {variable.required ? <span className="text-red-300">必填</span> : null}
          </span>
          <VariableInput
            variable={variable}
            value={workflow.inputValues[variable.id]}
            onChange={(value) => controller.setVariableValue(workflow.id, variable.id, value)}
          />
        </label>
      ))}
    </div>
  );
}

export function WorkflowBadge({ workflow }: { workflow: WorkflowDocument }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-amber-200/80" title={workflow.name}>
      <Workflow size={10} className="shrink-0" />
      <span className="truncate">{workflow.name}</span>
    </span>
  );
}

function VariableInput({ variable, value, onChange }: { variable: WorkflowVariableDefinition; value: unknown; onChange: (value: unknown) => void }) {
  const classes = 'h-7 w-full rounded border border-white/10 bg-white/5 px-2 text-[10px] text-white outline-none focus:border-amber-300/60 nodrag nowheel';
  if (variable.type === 'select') {
    return (
      <select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={classes}>
        <option value="">选择...</option>
        {(variable.constraints.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (variable.type === 'number') {
    return <input type="number" value={typeof value === 'number' ? value : ''} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} className={classes} />;
  }
  if (variable.type === 'text') {
    return <input type="text" value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={classes} />;
  }
  const assetId = value && typeof value === 'object' && 'assetId' in value ? String((value as { assetId: unknown }).assetId || '') : '';
  return <input type="text" value={assetId} onChange={(event) => onChange(event.target.value ? { kind: variable.type, assetId: event.target.value } : '')} placeholder={`${variable.type} asset ID`} className={classes} />;
}
