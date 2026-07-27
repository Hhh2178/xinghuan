import { NATIVE_DETERMINISTIC_NODE_TYPES } from '@xinghuan/agent-core';

export type WorkerOperation = 'provider_execution' | 'output_recovery' | 'deterministic_canvas';
export type CanvasRunOperation = Extract<WorkerOperation, 'provider_execution' | 'deterministic_canvas'>;

export interface WorkerOperationHandlers<T = Record<string, unknown>> {
  providerExecution: (signal?: AbortSignal) => Promise<T>;
  outputRecovery: (signal?: AbortSignal) => Promise<T>;
  deterministicCanvas?: (signal?: AbortSignal) => Promise<T>;
}

export function resolveCanvasRunOperation(nodeType: string): CanvasRunOperation {
  return NATIVE_DETERMINISTIC_NODE_TYPES.has(nodeType) || nodeType === 'resize'
    ? 'deterministic_canvas'
    : 'provider_execution';
}

export async function dispatchWorkerOperation<T = Record<string, unknown>>(input: {
  operation: WorkerOperation;
  signal?: AbortSignal;
  handlers: WorkerOperationHandlers<T>;
}): Promise<T> {
  if (input.operation === 'output_recovery') return input.handlers.outputRecovery(input.signal);
  if (input.operation === 'deterministic_canvas') {
    if (!input.handlers.deterministicCanvas) throw new Error('WORKER_DETERMINISTIC_HANDLER_MISSING');
    return input.handlers.deterministicCanvas(input.signal);
  }
  return input.handlers.providerExecution(input.signal);
}
