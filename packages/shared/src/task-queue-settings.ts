export type TaskQueueCapability = "image" | "audio" | "video" | "chat";

export interface TaskQueueCapabilityConfig {
  concurrency: number;
  userConcurrency: number;
}

export interface RunningHubQueueSettings {
  concurrency: number;
  enabled: boolean;
}

export interface TaskQueueSettings {
  image: TaskQueueCapabilityConfig;
  audio: TaskQueueCapabilityConfig;
  video: TaskQueueCapabilityConfig;
  chat: TaskQueueCapabilityConfig;
  runninghub: RunningHubQueueSettings;
}

export interface TaskQueueRuntimeDescriptor {
  capability: TaskQueueCapability;
  queue: string;
  concurrency: number;
}

export interface TaskQueueWorkerRuntimeSlot {
  workerId: string;
  capability: TaskQueueCapability;
  queue: string;
  slotIndex: number;
  state: "active" | "stopping";
  updatedAt: number;
}

export interface TaskQueueRuntimeQueueStatus extends TaskQueueRuntimeDescriptor {
  userConcurrency?: number;
  depth?: number;
  effectiveConcurrency?: number;
  workerCount?: number;
}

export const TASK_QUEUE_CAPABILITIES: TaskQueueCapability[] = ["image", "audio", "video", "chat"];
export const TASK_QUEUE_DEFAULT_CONCURRENCY = 100;
export const TASK_QUEUE_MAX_CONCURRENCY = 999;
export const TASK_QUEUE_MIN_CONCURRENCY = 1;
export const TASK_QUEUE_DEFAULT_USER_CONCURRENCY = 8;
export const TASK_QUEUE_MAX_USER_CONCURRENCY = 999;

export function clampTaskQueueConcurrency(value: unknown, fallback = TASK_QUEUE_DEFAULT_CONCURRENCY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(TASK_QUEUE_MAX_CONCURRENCY, Math.max(TASK_QUEUE_MIN_CONCURRENCY, rounded));
}

export function clampTaskQueueUserConcurrency(value: unknown, fallback = TASK_QUEUE_DEFAULT_USER_CONCURRENCY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(TASK_QUEUE_MAX_USER_CONCURRENCY, Math.max(TASK_QUEUE_MIN_CONCURRENCY, rounded));
}

export function defaultTaskQueueSettings(): TaskQueueSettings {
  return {
    image: { concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY, userConcurrency: TASK_QUEUE_DEFAULT_USER_CONCURRENCY },
    audio: { concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY, userConcurrency: TASK_QUEUE_DEFAULT_USER_CONCURRENCY },
    video: { concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY, userConcurrency: TASK_QUEUE_DEFAULT_USER_CONCURRENCY },
    chat: { concurrency: 20, userConcurrency: 4 },
    runninghub: { concurrency: 2, enabled: true },
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
      userConcurrency: clampTaskQueueUserConcurrency(
        isRecord(source.image) ? source.image.userConcurrency : undefined,
        base.image.userConcurrency,
      ),
    },
    audio: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.audio) ? source.audio.concurrency : undefined,
        base.audio.concurrency,
      ),
      userConcurrency: clampTaskQueueUserConcurrency(
        isRecord(source.audio) ? source.audio.userConcurrency : undefined,
        base.audio.userConcurrency,
      ),
    },
    video: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.video) ? source.video.concurrency : undefined,
        base.video.concurrency,
      ),
      userConcurrency: clampTaskQueueUserConcurrency(
        isRecord(source.video) ? source.video.userConcurrency : undefined,
        base.video.userConcurrency,
      ),
    },
    chat: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.chat) ? source.chat.concurrency : undefined,
        base.chat.concurrency,
      ),
      userConcurrency: clampTaskQueueUserConcurrency(
        isRecord(source.chat) ? source.chat.userConcurrency : undefined,
        base.chat.userConcurrency,
      ),
    },
    runninghub: {
      concurrency: clampTaskQueueConcurrency(
        isRecord(source.runninghub) ? source.runninghub.concurrency : undefined,
        base.runninghub.concurrency,
      ),
      enabled: isRecord(source.runninghub) ? source.runninghub.enabled !== false : base.runninghub.enabled,
    },
  };
}

export function taskQueueNameForCapability(baseQueueName: string, capability: TaskQueueCapability) {
  const base = String(baseQueueName || "xinghuan:tasks").trim() || "xinghuan:tasks";
  return `${base}:${capability}`;
}

export function taskQueueWorkerRuntimeKey(environment: unknown, workerId: unknown) {
  return `xinghuan:worker-runtime:${runtimeKeyPart(environment, "local")}:${runtimeKeyPart(workerId, "worker")}`;
}

export function taskQueueWorkerRuntimePattern(environment: unknown) {
  return `xinghuan:worker-runtime:${runtimeKeyPart(environment, "local")}:*`;
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

function runtimeKeyPart(value: unknown, fallback: string) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}
