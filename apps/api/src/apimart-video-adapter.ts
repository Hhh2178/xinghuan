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
  requestValueTypes?: Record<string, string>;
  requestValueTemplates?: Record<string, string>;
  fixedBody?: Record<string, unknown>;
}

interface ExtractApimartTaskOptions {
  taskIdPath?: string;
  statusPath?: string;
  allowGenericIdFallback?: boolean;
}

interface ExtractApimartVideoResultOptions {
  statusPath?: string;
  resultVideoPath?: string;
}

interface ExtractApimartFinalTaskOptions {
  taskIdPath?: string;
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
  const valueTypes = plainObject(input.requestValueTypes) as Record<string, string>;
  assignMapped(payload, mapping.ratio, castMappedValue(input.ratio, valueTypes.ratio));
  assignMapped(payload, mapping.duration, castMappedValue(input.duration, valueTypes.duration));
  assignMapped(payload, mapping.resolution, castMappedValue(input.resolution, valueTypes.resolution));
  if (Array.isArray(input.images) && input.images.length > 0) assignMapped(payload, mapping.images, castMappedValue(input.images, valueTypes.images));
  assignMapped(payload, mapping.firstFrame, castMappedValue(input.firstFrame, valueTypes.firstFrame));
  assignMapped(payload, mapping.lastFrame, castMappedValue(input.lastFrame, valueTypes.lastFrame));

  const mergedPayload = { ...payload, ...plainObject(input.fixedBody) };
  applyValueTemplates(mergedPayload, plainObject(input.requestValueTemplates), input);
  return mergedPayload;
}

export function resolveApimartVideoMultipartFieldNames(input: {
  requestMapping?: Record<string, string>;
  requestFileFields?: string[];
}) {
  const mapping = { ...DEFAULT_REQUEST_MAPPING, ...plainObject(input.requestMapping) } as Record<string, string>;
  const requested = Array.isArray(input.requestFileFields) ? input.requestFileFields : [];
  const out: string[] = [];
  for (const raw of requested) {
    const item = String(raw || "").trim();
    if (!item) continue;
    const resolved =
      item === "images" ? mapping.images
        : item === "firstFrame" ? mapping.firstFrame
          : item === "lastFrame" ? mapping.lastFrame
            : item;
    if (resolved && !out.includes(resolved)) out.push(resolved);
  }
  return out;
}

export function extractApimartTask(raw: unknown, options: ExtractApimartTaskOptions = {}) {
  const data = firstDataNode(raw);
  const allowGenericIdFallback = options.allowGenericIdFallback === true || !options.taskIdPath;
  return {
    taskId: readStringAtPath(raw, options.taskIdPath || "data.0.task_id")
      || readStringAtPath(raw, "data.task_id")
      || readStringAtPath(data, "task_id")
      || readStringAtPath(raw, "task_id")
      || (allowGenericIdFallback ? readStringAtPath(raw, "request_id") : "")
      || (allowGenericIdFallback ? readStringAtPath(raw, "id") : "")
      || (allowGenericIdFallback ? readStringAtPath(raw, "data.id") : "")
      || (allowGenericIdFallback ? readStringAtPath(data, "request_id") : "")
      || (allowGenericIdFallback ? readStringAtPath(data, "id") : ""),
    status: readStringAtPath(raw, options.statusPath || "data.0.status")
      || readStringAtPath(raw, "status")
      || readStringAtPath(raw, "data.status")
      || readStringAtPath(data, "status")
      || readStringAtPath(data, "request_status")
      || "",
    raw,
  };
}

export function extractApimartVideoResult(raw: unknown, options: ExtractApimartVideoResultOptions = {}) {
  const videoUrls = firstStringArrayAtPaths(raw, [
    options.resultVideoPath || "data.result.videos",
    "remixed_from_video_id",
    "data.output",
    "data.result.video_urls",
    "data.result.videoUrls",
    "data.result.video_url",
    "data.result.videoUrl",
    "data.result.data.0.url",
    "data.result.data.0.video_url",
    "data.result.outputs",
    "data.output.videos",
    "data.output.video_urls",
    "data.output.video_url",
    "data.output.videoUrl",
    "data.video.url",
    "data.video_url",
    "data.videoUrl",
    "data.videos",
    "video.url",
    "video_url",
    "videoUrl",
    "result.videos",
    "result.video_urls",
    "result.video_url",
    "result.videoUrl",
    "result.data.0.url",
    "result.data.0.video_url",
    "output",
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
    failureReason: extractApimartFailureReason(raw),
    videoUrls,
    raw,
  };
}

export function extractApimartFinalTaskId(raw: unknown, options: ExtractApimartFinalTaskOptions = {}) {
  return readStringAtPath(raw, options.taskIdPath || "")
    || readStringAtPath(raw, "video_id")
    || readStringAtPath(raw, "data.video_id")
    || readStringAtPath(raw, "result.video_id")
    || readStringAtPath(raw, "id")
    || readStringAtPath(raw, "data.id");
}

export function extractApimartFailureReason(raw: unknown) {
  const directPaths = [
    "data.error.message",
    "data.error",
    "data.message",
    "data.msg",
    "data.failure_reason",
    "data.failReason",
    "data.result.error.message",
    "data.result.error",
    "data.result.message",
    "data.result.failure_reason",
    "result.error.message",
    "result.error",
    "result.message",
    "result.failure_reason",
    "error.message",
    "error",
    "message",
    "msg",
    "failure_reason",
    "failReason",
    "detail",
  ];
  for (const path of directPaths) {
    const text = readReasonAtPath(raw, path);
    if (text) return text;
  }
  return findNestedReason(raw, 0);
}

export function shouldUseApimartVideoAdapter(input: ShouldUseApimartVideoAdapterInput) {
  const protocol = String(input.protocol || "").trim().toLowerCase();
  const advancedMode = String(input.advancedMode || "").trim().toLowerCase();
  const modelId = String(input.modelId || "").trim().toLowerCase();
  const providerBaseUrl = String(input.providerBaseUrl || "").trim().toLowerCase();
  if (protocol === "apimart") return true;
  if (advancedMode === "async_video_task") return true;
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

function castMappedValue(value: unknown, typeHint: string | undefined) {
  const type = String(typeHint || "").trim().toLowerCase();
  if (!type || value === undefined || value === null) return value;
  if (type === "string") {
    if (Array.isArray(value)) return value.map((item) => String(item));
    return String(value);
  }
  if (type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    return Boolean(value);
  }
  return value;
}

function applyValueTemplates(
  target: Record<string, unknown>,
  templates: Record<string, unknown>,
  input: ApimartVideoAdapterPayloadInput,
) {
  const videoSize = videoSizeFromRatioAndResolution(input.ratio, input.resolution);
  const context: Record<string, string> = {
    model: input.modelId,
    prompt: input.prompt,
    ratio: String(input.ratio || ""),
    duration: typeof input.duration === "string" || typeof input.duration === "number" ? String(input.duration) : "",
    resolution: String(input.resolution || ""),
    first_frame: String(input.firstFrame || ""),
    last_frame: String(input.lastFrame || ""),
    first_image: Array.isArray(input.images) ? String(input.images[0] || "") : "",
    image_count: String(Array.isArray(input.images) ? input.images.length : 0),
    video_size: videoSize,
    preview_video_size: videoSize,
  };
  for (const [key, rawTemplate] of Object.entries(templates)) {
    const template = String(rawTemplate || "").trim();
    if (!key || !template) continue;
    const rendered = template.replace(/\{([a-z0-9_]+)\}/gi, (_, token) => context[String(token || "").toLowerCase()] || "");
    if (rendered.trim()) target[key] = rendered.trim();
  }
}

function videoSizeFromRatioAndResolution(ratioValue: unknown, resolutionValue: unknown) {
  const ratio = String(ratioValue || "").trim();
  const resolution = String(resolutionValue || "").trim().toLowerCase();
  const shortEdge = resolution === "1080p" ? 1080 : resolution === "720p" ? 720 : resolution === "480p" ? 480 : 0;
  if (!shortEdge) return "";
  const match = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return "";
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return "";
  if (a >= b) {
    return `${roundEven(shortEdge * a / b)}x${shortEdge}`;
  }
  return `${shortEdge}x${roundEven(shortEdge * b / a)}`;
}

function roundEven(value: number) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
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

function readReasonAtPath(value: unknown, path: string): string {
  const result = readPath(value, path);
  return reasonText(result);
}

function reasonText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text && !/^https?:\/\//i.test(text) ? text.slice(0, 600) : "";
  }
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  for (const key of ["message", "error", "msg", "failure_reason", "failReason", "detail", "reason"]) {
    const text: string = reasonText(row[key]);
    if (text) return text;
  }
  return "";
}

function findNestedReason(value: unknown, depth: number): string {
  if (depth > 4 || !value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 8)) {
      const text = findNestedReason(item, depth + 1);
      if (text) return text;
    }
    return "";
  }
  const row = value as Record<string, unknown>;
  for (const key of ["error", "message", "msg", "failure_reason", "failReason", "detail", "reason"]) {
    const text = reasonText(row[key]);
    if (text) return text;
  }
  for (const key of ["data", "result", "output", "response"]) {
    const text = findNestedReason(row[key], depth + 1);
    if (text) return text;
  }
  return "";
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
