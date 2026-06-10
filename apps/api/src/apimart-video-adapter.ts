interface ApimartVideoAdapterPayloadInput {
  modelId: string;
  prompt: string;
  ratio?: string;
  duration?: string | number;
  resolution?: string;
  images?: string[];
  firstFrame?: string;
  lastFrame?: string;
  requestMapping?: Record<string, string>;
  fixedBody?: Record<string, unknown>;
}

interface ExtractApimartTaskOptions {
  taskIdPath?: string;
  statusPath?: string;
}

interface ExtractApimartVideoResultOptions {
  statusPath?: string;
  resultVideoPath?: string;
}

interface ShouldUseApimartVideoAdapterInput {
  protocol?: string;
  advancedMode?: string;
  modelId?: string;
  providerBaseUrl?: string;
}

const DEFAULT_REQUEST_MAPPING = {
  ratio: "size",
  duration: "duration",
  resolution: "quality",
  images: "image_urls",
  firstFrame: "first_frame",
  lastFrame: "last_frame",
} as const;

export function createApimartVideoAdapterPayload(input: ApimartVideoAdapterPayloadInput) {
  const payload: Record<string, unknown> = {
    model: input.modelId,
    prompt: input.prompt,
  };
  const mapping = { ...DEFAULT_REQUEST_MAPPING, ...plainObject(input.requestMapping) } as Record<string, string>;

  assignMapped(payload, mapping.ratio, input.ratio);
  assignMapped(payload, mapping.duration, input.duration);
  assignMapped(payload, mapping.resolution, input.resolution);
  if (Array.isArray(input.images) && input.images.length > 0) assignMapped(payload, mapping.images, input.images);
  assignMapped(payload, mapping.firstFrame, input.firstFrame);
  assignMapped(payload, mapping.lastFrame, input.lastFrame);

  return { ...payload, ...plainObject(input.fixedBody) };
}

export function extractApimartTask(raw: unknown, options: ExtractApimartTaskOptions = {}) {
  const data = firstDataNode(raw);
  return {
    taskId: readStringAtPath(raw, options.taskIdPath || "data.0.task_id")
      || readStringAtPath(raw, "data.task_id")
      || readStringAtPath(data, "task_id")
      || readStringAtPath(raw, "task_id"),
    status: readStringAtPath(raw, options.statusPath || "data.0.status")
      || readStringAtPath(raw, "data.status")
      || readStringAtPath(data, "status")
      || "",
    raw,
  };
}

export function extractApimartVideoResult(raw: unknown, options: ExtractApimartVideoResultOptions = {}) {
  const videoUrls = firstStringArrayAtPaths(raw, [
    options.resultVideoPath || "data.result.videos",
    "data.result.video_urls",
    "data.result.videoUrls",
    "data.result.video_url",
    "data.result.videoUrl",
    "data.result.outputs",
    "data.output.videos",
    "data.output.video_urls",
    "data.output.video_url",
    "data.output.videoUrl",
    "data.video.url",
    "data.video_url",
    "data.videoUrl",
    "data.videos",
    "result.videos",
    "result.video_urls",
    "result.video_url",
    "result.videoUrl",
    "output.videos",
    "output.video_urls",
    "output.video_url",
    "output.videoUrl",
  ]) || [];
  return {
    status: readStringAtPath(raw, options.statusPath || "data.status")
      || readStringAtPath(raw, "data.0.status")
      || readStringAtPath(raw, "status")
      || "",
    videoUrls,
    raw,
  };
}

export function shouldUseApimartVideoAdapter(input: ShouldUseApimartVideoAdapterInput) {
  const protocol = String(input.protocol || "").trim().toLowerCase();
  const advancedMode = String(input.advancedMode || "").trim().toLowerCase();
  const modelId = String(input.modelId || "").trim().toLowerCase();
  const providerBaseUrl = String(input.providerBaseUrl || "").trim().toLowerCase();
  if (protocol === "apimart") return true;
  if (advancedMode === "apimart_async_video") return true;
  if (modelId.includes("apimart")) return true;
  return providerBaseUrl.includes("apimart.ai");
}

function assignMapped(target: Record<string, unknown>, key: string | undefined, value: unknown) {
  if (!key) return;
  if (typeof value === "string" && value.trim()) {
    target[key] = value.trim();
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
    return;
  }
  if (Array.isArray(value) && value.length > 0) {
    target[key] = value;
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstDataNode(value: unknown) {
  const data = readPath(value, "data");
  if (Array.isArray(data)) return data[0];
  return data;
}

function readStringAtPath(value: unknown, path: string) {
  const result = readPath(value, path);
  return typeof result === "string" ? result.trim() : "";
}

function readStringArrayAtPath(value: unknown, path: string) {
  const result = readPath(value, path);
  return toStringArray(result);
}

function firstStringArrayAtPaths(value: unknown, paths: string[]) {
  for (const path of paths) {
    const values = readStringArrayAtPath(value, path);
    if (values && values.length > 0) return values;
  }
  return null;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    const out = value
      .flatMap((item) => nestedStringValues(item))
      .filter(Boolean);
    return out.length > 0 ? out : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? [text] : null;
  }
  if (value && typeof value === "object") {
    const out = nestedStringValues(value).filter(Boolean);
    return out.length > 0 ? out : null;
  }
  return null;
}

function nestedStringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => nestedStringValues(item)).filter(Boolean);
  }
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  for (const key of ["url", "video_url", "videoUrl", "src", "file_url"]) {
    const next = nestedStringValues(row[key]);
    if (next.length > 0) return next;
  }
  return [];
}

function readPath(value: unknown, path: string) {
  const parts = String(path || "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  let current: unknown = value;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(part, 10);
      current = Number.isFinite(index) ? current[index] : undefined;
      continue;
    }
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
