import {
  TASK_QUEUE_CAPABILITIES,
  taskQueueWorkerRuntimePattern,
  type TaskQueueCapability,
  type TaskQueueWorkerRuntimeSlot,
} from "@xinghuan/shared";

export interface WorkerRuntimeRedisReader {
  scanIterator: (options: { MATCH: string; COUNT: number }) => AsyncIterable<string[] | string>;
  get: (key: string) => Promise<string | null>;
}

export async function readEnvironmentWorkerRuntimeSlots(
  client: WorkerRuntimeRedisReader,
  environment: string,
): Promise<TaskQueueWorkerRuntimeSlot[]> {
  const slots: TaskQueueWorkerRuntimeSlot[] = [];
  for await (const scanned of client.scanIterator({ MATCH: taskQueueWorkerRuntimePattern(environment), COUNT: 100 })) {
    const keys = Array.isArray(scanned) ? scanned : [scanned];
    const rawValues = await Promise.all(keys.map((key) => client.get(key).catch(() => null)));
    for (const rawValue of rawValues) appendRuntimeSlots(slots, rawValue);
  }
  return slots;
}

export function summarizeWorkerRuntimeQueue(slots: TaskQueueWorkerRuntimeSlot[], queue: string) {
  const queueSlots = slots.filter((slot) => slot.queue === queue);
  return {
    effectiveConcurrency: queueSlots.filter((slot) => slot.state === "active").length,
    workerCount: new Set(queueSlots.map((slot) => slot.workerId).filter(Boolean)).size,
    slotCount: queueSlots.length,
  };
}

function appendRuntimeSlots(target: TaskQueueWorkerRuntimeSlot[], rawValue: string | null) {
  if (!rawValue) return;
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      const slot = normalizeWorkerRuntimeSlot(item);
      if (slot) target.push(slot);
    }
  } catch {
    return;
  }
}

function normalizeWorkerRuntimeSlot(value: unknown): TaskQueueWorkerRuntimeSlot | null {
  const source = isRecord(value) ? value : {};
  const capability = String(source.capability || "") as TaskQueueCapability;
  const queue = String(source.queue || "").trim();
  if (!TASK_QUEUE_CAPABILITIES.includes(capability) || !queue) return null;
  return {
    workerId: String(source.workerId || "").trim(),
    capability,
    queue,
    slotIndex: Math.max(0, Number(source.slotIndex) || 0),
    state: source.state === "stopping" ? "stopping" : "active",
    updatedAt: Number(source.updatedAt) || Date.now(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
