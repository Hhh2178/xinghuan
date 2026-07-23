import { useEffect } from 'react';
import { Braces } from 'lucide-react';

import type { MediaKind } from '../../utils/mediaCollection';
import { useCanvasWorkflows } from '../canvas/CanvasWorkflowContext';
import { WorkflowBadge, WorkflowMembershipControl, WorkflowVariableValues } from '../canvas/WorkflowVariableControls';

const MEDIA_LABEL: Record<MediaKind, string> = {
  image: '图像',
  video: '视频',
  audio: '音频',
};

export function UploadWorkflowVariableToggle({
  nodeId,
  isDark,
  open,
  onToggle,
}: {
  nodeId: string;
  isDark: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const controller = useCanvasWorkflows();
  const workflow = controller.workflowForNode(nodeId);
  return (
    <>
      {workflow ? <WorkflowBadge workflow={workflow} /> : null}
      <button
        type="button"
        onClick={onToggle}
        className={`nodrag nopan inline-flex h-6 w-6 items-center justify-center rounded ${open ? 'bg-amber-300 text-zinc-950' : isDark ? 'bg-white/5 text-white/55 hover:bg-white/10' : 'bg-black/5 text-zinc-600 hover:bg-black/10'}`}
        title="工作流变量"
        aria-label="工作流变量"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Braces size={12} />
      </button>
    </>
  );
}

export function UploadWorkflowVariablePanel({
  nodeId,
  uploadType,
  url,
  isDark,
  open,
}: {
  nodeId: string;
  uploadType: MediaKind | null;
  url?: string;
  isDark: boolean;
  open: boolean;
}) {
  const controller = useCanvasWorkflows();
  const workflow = controller.workflowForNode(nodeId);
  const fieldPath = uploadType ? `input.reference_${uploadType}` : '';
  const fieldBinding = workflow?.bindings.find((binding) => binding.nodeId === nodeId && binding.fieldPath === fieldPath);
  const boundVariableId = fieldBinding?.binding.mode === 'variable' ? fieldBinding.binding.variableId : '';

  useEffect(() => {
    if (!workflow || !uploadType || !boundVariableId || !url) return;
    controller.setVariableValue(workflow.id, boundVariableId, { kind: uploadType, assetId: url });
  }, [boundVariableId, controller, uploadType, url, workflow]);

  if (!open) return null;

  const bindVariable = (variableId: string) => {
    if (!workflow || !uploadType) return;
    if (!variableId) {
      controller.setFieldBinding(workflow.id, nodeId, fieldPath, uploadType, { mode: 'fixed' });
      return;
    }
    controller.setFieldBinding(workflow.id, nodeId, fieldPath, uploadType, { mode: 'variable', variableId });
    if (url) controller.setVariableValue(workflow.id, variableId, { kind: uploadType, assetId: url });
  };

  const createAndBindVariable = () => {
    if (!workflow || !uploadType) return;
    const variableId = controller.addVariable(workflow.id, uploadType, `${MEDIA_LABEL[uploadType]}输入`);
    bindVariable(variableId);
  };

  return (
    <div className={`nodrag nowheel space-y-2 rounded-md border p-2 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-black/[0.03]'}`}>
      <WorkflowMembershipControl nodeId={nodeId} workflow={workflow} />
      {workflow && uploadType ? (
        <>
          <div className="flex gap-1.5">
            <select
              value={boundVariableId}
              onChange={(event) => bindVariable(event.target.value)}
              className={`h-7 min-w-0 flex-1 rounded border px-1.5 text-[10px] outline-none ${isDark ? 'border-white/10 bg-zinc-900 text-white' : 'border-black/10 bg-white text-zinc-900'}`}
            >
              <option value="">固定素材</option>
              {workflow.variables.filter((variable) => variable.type === uploadType).map((variable) => (
                <option key={variable.id} value={variable.id}>{variable.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={createAndBindVariable}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border ${isDark ? 'border-white/10 bg-white/5 text-white/70' : 'border-black/10 bg-black/5 text-zinc-700'}`}
              title={`新建${MEDIA_LABEL[uploadType]}变量`}
            >
              <Braces size={12} />
            </button>
          </div>
          {boundVariableId ? <WorkflowVariableValues workflow={workflow} variableIds={[boundVariableId]} /> : null}
        </>
      ) : null}
    </div>
  );
}
