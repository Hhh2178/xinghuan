export interface AgentRuntimeProcessGates {
  apiCanvasRunsEnabled: boolean;
  workerCanvasRunsEnabled: boolean;
}

export function readAgentRuntimeProcessGates(
  env: Record<string, string | undefined>,
): AgentRuntimeProcessGates {
  return {
    apiCanvasRunsEnabled: env.XINGHUAN_CANVAS_RUNS_ENABLED === 'true',
    workerCanvasRunsEnabled: env.XINGHUAN_CANVAS_RUN_WORKER_ENABLED === 'true',
  };
}
