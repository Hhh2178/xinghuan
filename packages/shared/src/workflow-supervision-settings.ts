export type WorkflowRetryExhaustionPolicy = "stop" | "compatible_fallback";
export type WorkflowCandidateSelectionMode = "manual" | "ai";
export type WorkflowSupervisionSettingSource = "platform_default" | "workflow_default" | "remembered" | "run_override";

export interface WorkflowSupervisionSettings {
  defaultRetryCount: number;
  retryExhaustionPolicy: WorkflowRetryExhaustionPolicy;
  maxFallbackCount: number;
  promptReviewRewriteEnabled: boolean;
  promptReviewMaxRetries: number;
  stageConcurrency: number;
  maxDurationSeconds: number;
  maxCost: string;
  currency: string;
  candidateSelectionMode: WorkflowCandidateSelectionMode;
  candidateSelectionCount: number;
  candidateMinimumConfidence: number;
  lowConfidenceManualFallback: boolean;
  nodeRetryOverrides: Record<string, number>;
}

export type WorkflowSupervisionSettingsInput = Partial<WorkflowSupervisionSettings>;

export interface WorkflowSupervisionLimits {
  maxRetryCount: number;
  maxFallbackCount: number;
  maxPromptReviewRetries: number;
  maxStageConcurrency: number;
  maxDurationSeconds: number;
  maxCost: string;
  maxCandidateSelectionCount: number;
  maxNodeRetryOverrides: number;
}

export const DEFAULT_WORKFLOW_SUPERVISION_SETTINGS: WorkflowSupervisionSettings = Object.freeze({
  defaultRetryCount: 3,
  retryExhaustionPolicy: "stop",
  maxFallbackCount: 0,
  promptReviewRewriteEnabled: false,
  promptReviewMaxRetries: 1,
  stageConcurrency: 4,
  maxDurationSeconds: 3_600,
  maxCost: "0",
  currency: "CNY",
  candidateSelectionMode: "manual",
  candidateSelectionCount: 1,
  candidateMinimumConfidence: 0,
  lowConfidenceManualFallback: true,
  nodeRetryOverrides: Object.freeze({}),
});

export const DEFAULT_WORKFLOW_SUPERVISION_LIMITS: WorkflowSupervisionLimits = Object.freeze({
  maxRetryCount: 10,
  maxFallbackCount: 10,
  maxPromptReviewRetries: 10,
  maxStageConcurrency: 16,
  maxDurationSeconds: 86_400,
  maxCost: "1000000",
  maxCandidateSelectionCount: 16,
  maxNodeRetryOverrides: 200,
});

const SETTING_KEYS = [
  "defaultRetryCount",
  "retryExhaustionPolicy",
  "maxFallbackCount",
  "promptReviewRewriteEnabled",
  "promptReviewMaxRetries",
  "stageConcurrency",
  "maxDurationSeconds",
  "maxCost",
  "currency",
  "candidateSelectionMode",
  "candidateSelectionCount",
  "candidateMinimumConfidence",
  "lowConfidenceManualFallback",
  "nodeRetryOverrides",
] as const satisfies readonly (keyof WorkflowSupervisionSettings)[];

export interface ResolvedWorkflowSupervisionSettings {
  settings: WorkflowSupervisionSettings;
  sources: Record<keyof WorkflowSupervisionSettings, WorkflowSupervisionSettingSource>;
  overriddenFields: string[];
  clampedFields: string[];
}

export function resolveWorkflowSupervisionSettings(input: {
  limits?: Partial<WorkflowSupervisionLimits>;
  workflowDefaults?: WorkflowSupervisionSettingsInput;
  remembered?: WorkflowSupervisionSettingsInput;
  runOverride?: WorkflowSupervisionSettingsInput;
}): ResolvedWorkflowSupervisionSettings {
  const limits = normalizeWorkflowSupervisionLimits(input.limits);
  const settings = cloneSettings(DEFAULT_WORKFLOW_SUPERVISION_SETTINGS);
  const sources = Object.fromEntries(SETTING_KEYS.map((key) => [key, "platform_default"])) as ResolvedWorkflowSupervisionSettings["sources"];
  const overriddenFields: string[] = [];
  const clampedFields: string[] = [];

  applyLayer(settings, sources, input.workflowDefaults, "workflow_default");
  applyLayer(settings, sources, input.remembered, "remembered");
  applyLayer(settings, sources, input.runOverride, "run_override", overriddenFields);
  clampSettings(settings, limits, clampedFields);

  return {
    settings: Object.freeze({ ...settings, nodeRetryOverrides: Object.freeze({ ...settings.nodeRetryOverrides }) }),
    sources: Object.freeze({ ...sources }),
    overriddenFields: Object.freeze([...new Set(overriddenFields)]) as string[],
    clampedFields: Object.freeze([...new Set(clampedFields)]) as string[],
  };
}

export function normalizeWorkflowSupervisionOverrides(input: unknown): WorkflowSupervisionSettingsInput {
  if (!isRecord(input)) return {};
  const settings = cloneSettings(DEFAULT_WORKFLOW_SUPERVISION_SETTINGS);
  const output: WorkflowSupervisionSettingsInput = {};
  const sources = Object.fromEntries(SETTING_KEYS.map((key) => [key, "platform_default"])) as ResolvedWorkflowSupervisionSettings["sources"];
  applyLayer(settings, sources, input, "run_override");
  for (const key of SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) assignSetting(output, key, settings[key]);
  }
  return output;
}

export function normalizeWorkflowSupervisionLimits(input: Partial<WorkflowSupervisionLimits> | undefined): WorkflowSupervisionLimits {
  const raw = input || {};
  return {
    maxRetryCount: integer(raw.maxRetryCount, 0, 10, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxRetryCount),
    maxFallbackCount: integer(raw.maxFallbackCount, 0, 100, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxFallbackCount),
    maxPromptReviewRetries: integer(raw.maxPromptReviewRetries, 0, 10, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxPromptReviewRetries),
    maxStageConcurrency: integer(raw.maxStageConcurrency, 1, 64, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxStageConcurrency),
    maxDurationSeconds: integer(raw.maxDurationSeconds, 60, 604_800, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxDurationSeconds),
    maxCost: decimal(raw.maxCost, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxCost),
    maxCandidateSelectionCount: integer(raw.maxCandidateSelectionCount, 1, 64, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxCandidateSelectionCount),
    maxNodeRetryOverrides: integer(raw.maxNodeRetryOverrides, 0, 1_000, DEFAULT_WORKFLOW_SUPERVISION_LIMITS.maxNodeRetryOverrides),
  };
}

function applyLayer(
  target: WorkflowSupervisionSettings,
  sources: ResolvedWorkflowSupervisionSettings["sources"],
  raw: unknown,
  source: WorkflowSupervisionSettingSource,
  changed?: string[],
) {
  if (!isRecord(raw)) return;
  for (const key of SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const next = normalizeSetting(key, raw[key], target[key]);
    assignSetting(target, key, next);
    sources[key] = source;
    changed?.push(key);
  }
}

function normalizeSetting<K extends keyof WorkflowSupervisionSettings>(
  key: K,
  value: unknown,
  fallback: WorkflowSupervisionSettings[K],
): WorkflowSupervisionSettings[K] {
  switch (key) {
    case "defaultRetryCount": return integer(value, 0, 10, fallback as number) as WorkflowSupervisionSettings[K];
    case "retryExhaustionPolicy": return (value === "compatible_fallback" ? value : value === "stop" ? value : fallback) as WorkflowSupervisionSettings[K];
    case "maxFallbackCount": return integer(value, 0, 100, fallback as number) as WorkflowSupervisionSettings[K];
    case "promptReviewRewriteEnabled":
    case "lowConfidenceManualFallback": return (value === true ? true : value === false ? false : fallback) as WorkflowSupervisionSettings[K];
    case "promptReviewMaxRetries": return integer(value, 0, 10, fallback as number) as WorkflowSupervisionSettings[K];
    case "stageConcurrency": return integer(value, 1, 64, fallback as number) as WorkflowSupervisionSettings[K];
    case "maxDurationSeconds": return integer(value, 60, 604_800, fallback as number) as WorkflowSupervisionSettings[K];
    case "maxCost": return decimal(value, fallback as string) as WorkflowSupervisionSettings[K];
    case "currency": return (typeof value === "string" && /^[A-Z]{3}$/.test(value) ? value : fallback) as WorkflowSupervisionSettings[K];
    case "candidateSelectionMode": return (value === "ai" ? value : value === "manual" ? value : fallback) as WorkflowSupervisionSettings[K];
    case "candidateSelectionCount": return integer(value, 1, 64, fallback as number) as WorkflowSupervisionSettings[K];
    case "candidateMinimumConfidence": return boundedNumber(value, 0, 100, fallback as number) as WorkflowSupervisionSettings[K];
    case "nodeRetryOverrides": return normalizeNodeRetryOverrides(value) as WorkflowSupervisionSettings[K];
  }
}

function clampSettings(settings: WorkflowSupervisionSettings, limits: WorkflowSupervisionLimits, clamped: string[]) {
  clampInteger(settings, "defaultRetryCount", limits.maxRetryCount, clamped);
  clampInteger(settings, "maxFallbackCount", limits.maxFallbackCount, clamped);
  clampInteger(settings, "promptReviewMaxRetries", limits.maxPromptReviewRetries, clamped);
  clampInteger(settings, "stageConcurrency", limits.maxStageConcurrency, clamped);
  clampInteger(settings, "maxDurationSeconds", limits.maxDurationSeconds, clamped);
  clampInteger(settings, "candidateSelectionCount", limits.maxCandidateSelectionCount, clamped);
  if (Number(settings.maxCost) > Number(limits.maxCost)) {
    settings.maxCost = limits.maxCost;
    clamped.push("maxCost");
  }
  const overrides: Record<string, number> = {};
  for (const [nodeId, count] of Object.entries(settings.nodeRetryOverrides).sort(([left], [right]) => left.localeCompare(right)).slice(0, limits.maxNodeRetryOverrides)) {
    const next = Math.min(count, limits.maxRetryCount);
    if (next !== count) clamped.push(`nodeRetryOverrides.${nodeId}`);
    overrides[nodeId] = next;
  }
  if (Object.keys(settings.nodeRetryOverrides).length > limits.maxNodeRetryOverrides) clamped.push("nodeRetryOverrides");
  settings.nodeRetryOverrides = overrides;
}

function clampInteger<K extends "defaultRetryCount" | "maxFallbackCount" | "promptReviewMaxRetries" | "stageConcurrency" | "maxDurationSeconds" | "candidateSelectionCount">(
  settings: WorkflowSupervisionSettings,
  key: K,
  maximum: number,
  clamped: string[],
) {
  if (settings[key] <= maximum) return;
  settings[key] = maximum;
  clamped.push(key);
}

function normalizeNodeRetryOverrides(value: unknown) {
  if (!isRecord(value)) return {};
  const output: Record<string, number> = {};
  for (const [rawNodeId, rawCount] of Object.entries(value)) {
    const nodeId = rawNodeId.trim().slice(0, 160);
    if (!nodeId) continue;
    output[nodeId] = integer(rawCount, 0, 10, 0);
  }
  return output;
}

function cloneSettings(settings: WorkflowSupervisionSettings): WorkflowSupervisionSettings {
  return { ...settings, nodeRetryOverrides: { ...settings.nodeRetryOverrides } };
}

function assignSetting<K extends keyof WorkflowSupervisionSettings>(target: Partial<WorkflowSupervisionSettings>, key: K, value: WorkflowSupervisionSettings[K]) {
  (target as Record<keyof WorkflowSupervisionSettings, unknown>)[key] = value;
}

function integer(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function decimal(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^\d+(?:\.\d{1,6})?$/.test(text) ? text : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
