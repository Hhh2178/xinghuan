import type { CanvasRunFailureDiagnostic } from '@xinghuan/shared';
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
): CanvasRunAssistantContextDetail {
  const runId = diagnostic.location.runId || fallbackRunId;
  return {
    open: true,
    draft: CANVAS_RUN_FAILURE_ASSISTANT_DRAFT,
    attachments: [{
      id: `canvas-run-failure-${runId || 'current'}-${diagnostic.location.runStepId || diagnostic.technical.code}`,
      kind: 'node',
      title: diagnostic.location.nodeType ? `失败节点 ${diagnostic.location.nodeType}` : 'AI 托管失败诊断',
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
