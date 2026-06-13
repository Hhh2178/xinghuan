export type TaskQueueCapability = "image" | "audio" | "video";

export interface TaskQueueCapabilityConfig {
  concurrency: number;
}

export interface TaskQueueSettings {
  image: TaskQueueCapabilityConfig;
  audio: TaskQueueCapabilityConfig;
  video: TaskQueueCapabilityConfig;
}

export interface TaskQueueRuntimeDescriptor {
  capability: TaskQueueCapability;
  queue: string;
  concurrency: number;
}

export const TASK_QUEUE_CAPABILITIES: TaskQueueCapability[] = ["image", "audio", "video"];
export const TASK_QUEUE_MAX_CONCURRENCY = 4;
export const TASK_QUEUE_MIN_CONCURRENCY = 1;

export function clampTaskQueueConcurrency(value: unknown, fallback = TASK_QUEUE_MAX_CONCURRENCY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(TASK_QUEUE_MAX_CONCURRENCY, Math.max(TASK_QUEUE_MIN_CONCURRENCY, rounded));
}

export function defaultTaskQueueSettings(): TaskQueueSettings {
  return {
    image: { concurrency: TASK_QUEUE_MAX_CONCURRENCY },
    audio: { concurrency: TASK_QUEUE_MAX_CONCURRENCY },
    video: { concurrency: TASK_QUEUE_MAX_CONCURRENCY },
  };
}

export function normalizeTaskQueueSettings(value: unknown, base: TaskQueueSettings = defaultTaskQueueSettings()): TaskQueueSettings {
  const source = isRecord(value) ? value : {};
  return {
    image: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.image) ? source.image.concurrency : undefined,
        base.image.concurrency,
      ),
    },
    audio: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.audio) ? source.audio.concurrency : undefined,
        base.audio.concurrency,
      ),
    },
    video: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.video) ? source.video.concurrency : undefined,
        base.video.concurrency,
      ),
    },
  };
}

export function taskQueueNameForCapability(baseQueueName: string, capability: TaskQueueCapability) {
  const base = String(baseQueueName || "xinghuan:tasks").trim() || "xinghuan:tasks";
  return `${base}:${capability}`;
}

export function buildTaskQueueRuntimeDescriptors(baseQueueName: string, settings: TaskQueueSettings): TaskQueueRuntimeDescriptor[] {
  return TASK_QUEUE_CAPABILITIES.map((capability) => ({
    capability,
    queue: taskQueueNameForCapability(baseQueueName, capability),
    concurrency: settings[capability].concurrency,
  }));
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
