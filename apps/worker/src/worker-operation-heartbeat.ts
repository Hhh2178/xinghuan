export async function runWithOperationHeartbeat<T>(options: {
  intervalMs: number;
  heartbeat: () => Promise<unknown>;
  execute: () => Promise<T>;
}): Promise<T> {
  const intervalMs = Math.max(1_000, Math.floor(options.intervalMs));
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const schedule = () => {
    timer = setTimeout(async () => {
      if (stopped) return;
      await options.heartbeat().catch(() => undefined);
      if (!stopped) schedule();
    }, intervalMs);
  };
  schedule();
  try {
    return await options.execute();
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
  }
}
