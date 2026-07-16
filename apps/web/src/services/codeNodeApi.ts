import { safeRequest } from './api';

export interface CodeNodeExecutionResult {
  result: unknown;
  durationMs: number;
}

export function executeCodeNode(code: string, input: unknown) {
  return safeRequest<CodeNodeExecutionResult>('/api/code-node/execute', {
    method: 'POST',
    body: JSON.stringify({ code, input }),
  });
}
