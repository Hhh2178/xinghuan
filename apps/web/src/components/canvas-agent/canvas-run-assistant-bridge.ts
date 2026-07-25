import { resolveNodeDisplayIdentity, type CanvasRunFailureDiagnostic } from '@xinghuan/shared';
import { getNodeExecutionCapability } from '@xinghuan/agent-core';
import type { AssistantChatAttachment } from '../../services/api';

export const CANVAS_RUN_FAILURE_ASSISTANT_DRAFT = '请根据已附加的 AI 托管失败诊断，区分已观察事实、可能原因、受影响步骤和可执行修复动作。';

export interface CanvasRunAssistantContextDetail {
  open: true;
  draft: string;
  attachments: AssistantChatAttachment[];
}

export function buildCanvasRunAssistantContextDetail(
  diagnostic: CanvasRunFailureDiagnostic,
  fallbackRunId?: string,
  nodeDisplayName?: string,
): CanvasRunAssistantContextDetail {
  const runId = diagnostic.location.runId || fallbackRunId;
  const fallbackDisplayName = diagnostic.location.nodeId ? resolveNodeDisplayIdentity({
    nodeId: diagnostic.location.nodeId,
    nodeType: diagnostic.location.nodeType,
    catalogLabel: getNodeExecutionCapability(diagnostic.location.nodeType || '')?.label,
  }).displayName : getNodeExecutionCapability(diagnostic.location.nodeType || '')?.label;
  const displayName = nodeDisplayName || fallbackDisplayName;
  return {
    open: true,
    draft: CANVAS_RUN_FAILURE_ASSISTANT_DRAFT,
    attachments: [{
      id: `canvas-run-failure-${runId || 'current'}-${diagnostic.location.runStepId || diagnostic.technical.code}`,
      kind: 'node',
      title: displayName ? `失败节点 ${displayName}` : 'AI 托管失败诊断',
      summary: diagnostic.title,
      payload: {
        source: 'canvas_run_error',
        runId,
        nodeId: diagnostic.location.nodeId,
        nodeType: diagnostic.location.nodeType,
        diagnostic,
      },
    }],
  };
}
