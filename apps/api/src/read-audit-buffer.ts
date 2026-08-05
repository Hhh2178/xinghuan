export interface ReadAuditBufferOptions<T> {
  maxQueue?: number;
  maxBatch?: number;
  flushIntervalMs?: number;
  write: (items: T[]) => Promise<void>;
}

export function createReadAuditBuffer<T>(options: ReadAuditBufferOptions<T>) {
  const maxQueue = Math.max(1, Math.min(10_000, Math.trunc(options.maxQueue ?? 1_000)));
  const maxBatch = Math.max(1, Math.min(maxQueue, Math.trunc(options.maxBatch ?? 50)));
  const queue: T[] = [];
  let flushing: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dropped = 0;

  function schedule() {
    if (timer || flushing || queue.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, Math.max(10, Math.trunc(options.flushIntervalMs ?? 250)));
    timer.unref?.();
  }

  async function flush() {
    if (flushing) return flushing;
    if (queue.length === 0) return;
    const batch = queue.splice(0, maxBatch);
    flushing = options.write(batch)
      .catch(() => {
        queue.unshift(...batch);
      })
      .finally(() => {
        flushing = null;
        if (queue.length > 0) schedule();
      });
    return flushing;
  }

  function push(item: T) {
    if (queue.length >= maxQueue) {
      dropped += 1;
      return false;
    }
    queue.push(item);
    schedule();
    return true;
  }

  async function shutdown() {
    if (timer) clearTimeout(timer);
    timer = null;
    while (queue.length > 0) await flush();
  }

  return {
    push,
    flush,
    shutdown,
    snapshot: () => ({ queued: queue.length, dropped, flushing: Boolean(flushing) }),
  };
}
