import { projectCanvasRunFailureDiagnostic, type CanvasRunFailureDiagnostic } from '@xinghuan/shared';

export type CanvasRunErrorMessage = CanvasRunFailureDiagnostic;

export function describeCanvasRunError(rawCode: string): CanvasRunErrorMessage {
  return projectCanvasRunFailureDiagnostic({ code: rawCode || 'CANVAS_RUN_UNKNOWN_ERROR' });
}
