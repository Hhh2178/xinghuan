import { AlertTriangle, GitBranch, GripVertical, Rows3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { WorkflowDocument, WorkflowStageDefinition } from '@xinghuan/shared';

import { buildWorkflowStageProjection, reorderWorkflowStages } from './workflowStagePlanning';

export function WorkflowStageEditor(props: {
  canvasId: string | null;
  workflow: WorkflowDocument;
  nodes: Node[];
  edges: Edge[];
  locked: boolean;
  onChange: (stages: WorkflowStageDefinition[]) => void;
}) {
  const [draggedStageId, setDraggedStageId] = useState('');
  const [error, setError] = useState('');
  const projection = useMemo(() => {
    try {
      return { value: buildWorkflowStageProjection(props.workflow, props.nodes, props.edges), error: '' };
    } catch (cause) {
      return { value: null, error: cause instanceof Error ? cause.message : 'WORKFLOW_STAGE_INVALID' };
    }
  }, [props.edges, props.nodes, props.workflow]);

  if (!projection.value) {
    return <div className="workflow-stage-editor__error"><AlertTriangle size={14} />阶段结构不可用：{projection.error}</div>;
  }
  const sourceById = new Map(projection.value.sources.map((source) => [source.sourceGroupNodeId || '__ungrouped__', source]));

  const updateStage = (stageId: string, patch: Partial<WorkflowStageDefinition>) => {
    if (props.locked) return;
    setError('');
    props.onChange(projection.value!.stages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage));
  };

  const dropStage = (targetStageId: string) => {
    if (props.locked || !draggedStageId) return;
    const result = reorderWorkflowStages(projection.value!, draggedStageId, targetStageId, props.edges);
    setDraggedStageId('');
    if (result.conflict) {
      setError(`顺序与连线冲突：${result.conflict.source} → ${result.conflict.target}`);
      window.dispatchEvent(new CustomEvent('penguin:highlight-workflow-stage-conflict', {
        detail: {
          canvasId: props.canvasId,
          edgeId: result.conflict.edgeId,
          source: result.conflict.source,
          target: result.conflict.target,
        },
      }));
      return;
    }
    setError('');
    props.onChange(result.stages);
  };

  return (
    <section className="workflow-stage-editor" aria-label="工作流阶段顺序">
      <header>
        <span><Rows3 size={14} />执行阶段</span>
        <small>{props.locked ? '运行计划已锁定' : '拖动调整顺序'}</small>
      </header>
      <div className="workflow-stage-editor__list">
        {projection.value.stages.map((stage, index) => {
          const source = sourceById.get(stage.sourceGroupNodeId || '__ungrouped__');
          return (
            <div
              className="workflow-stage-editor__item"
              data-skipped={stage.skipped ? 'true' : 'false'}
              draggable={!props.locked}
              key={stage.id}
              onDragStart={() => setDraggedStageId(stage.id)}
              onDragEnd={() => setDraggedStageId('')}
              onDragOver={(event) => { if (!props.locked) event.preventDefault(); }}
              onDrop={() => dropStage(stage.id)}
            >
              <span className="workflow-stage-editor__grip" title="拖动排序"><GripVertical size={15} /></span>
              <span className="workflow-stage-editor__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="workflow-stage-editor__name"><strong>{stage.name}</strong><small>{source?.memberNodeIds.length || 0} 个节点</small></span>
              <span className="workflow-stage-editor__mode" role="group" aria-label={`${stage.name}执行方式`}>
                <button type="button" disabled={props.locked} aria-pressed={stage.mode === 'serial'} data-active={stage.mode === 'serial'} onClick={() => updateStage(stage.id, { mode: 'serial' })}>串行</button>
                <button type="button" disabled={props.locked} aria-pressed={stage.mode === 'parallel'} data-active={stage.mode === 'parallel'} onClick={() => updateStage(stage.id, { mode: 'parallel' })}><GitBranch size={12} />并行</button>
              </span>
              <label className="workflow-stage-editor__skip"><input type="checkbox" disabled={props.locked} checked={stage.skipped} onChange={(event) => updateStage(stage.id, { skipped: event.target.checked })} />跳过</label>
            </div>
          );
        })}
      </div>
      {error || projection.value.conflict ? <div className="workflow-stage-editor__error"><AlertTriangle size={14} />{error || '当前阶段顺序与工作流连线冲突'}</div> : null}
    </section>
  );
}
