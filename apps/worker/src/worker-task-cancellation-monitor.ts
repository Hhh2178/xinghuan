export interface WorkerTaskCancellationMonitor {
  signal: AbortSignal;
  stop: () => void;
}

export function createWorkerTaskCancellationMonitor(input: {
  taskId: string;
  intervalMs: number;
  isTaskCancelled: (taskId: string) => Promise<boolean>;
  schedule?: (callback: () => void, delay: number) => unknown;
  clear?: (handle: unknown) => void;
}): WorkerTaskCancellationMonitor {
  const controller = new AbortController();
  const schedule = input.schedule || ((callback, delay) => setInterval(callback, delay));
  const clear = input.clear || ((handle) => clearInterval(handle as NodeJS.Timeout));
  let stopped = false;

  const check = async () => {
    if (stopped || controller.signal.aborted) return;
    if (await input.isTaskCancelled(input.taskId)) controller.abort();
  };
  const handle = schedule(() => { void check(); }, Math.max(250, input.intervalMs));
  void check();

  return {
    signal: controller.signal,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clear(handle);
    },
  };
}
