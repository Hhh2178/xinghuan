import {
  analyzeComfyuiWorkflow,
  buildDefaultComfyuiInputSchema,
  buildDefaultComfyuiOutputSchema,
  migrateLegacyComfyuiWorkflowSchema,
  type ComfyuiWorkflowInstanceBinding,
} from "@xinghuan/shared";
import type { ComfyuiWorkflowDraft } from "./comfyui-workflow-registry.js";

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function buildLegacyExposedFields(draft: ComfyuiWorkflowDraft, defaultValues: Record<string, unknown>) {
  return draft.inputSchema
    .filter((item) => item.mode !== "hidden")
    .map((item) => ({
      key: item.key,
      nodeId: item.nodeId,
      fieldName: item.fieldName,
      label: item.label,
      source: item.source,
      kind: item.kind,
      required: item.required,
      value: Object.prototype.hasOwnProperty.call(defaultValues, item.key)
        ? cloneJson(defaultValues[item.key])
        : cloneJson(item.defaultValue),
    }));
}

function normalizeInstanceBindings(draft: ComfyuiWorkflowDraft) {
  const raw = Array.isArray(draft.instanceBindings) ? draft.instanceBindings : [];
  const seen = new Set<string>();
  const bindings = raw
    .map((item) => ({
      instanceId: String(item.instanceId || "").trim(),
      enabled: item.enabled !== false,
      isDefault: item.isDefault === true,
      executionMode: item.executionMode === "fixed" || item.executionMode === "pool"
        ? item.executionMode
        : "selectable",
      capabilityTags: Array.isArray(item.capabilityTags) ? item.capabilityTags.map((tag: unknown) => String(tag)).filter(Boolean) : [],
    } satisfies ComfyuiWorkflowInstanceBinding))
    .filter((item) => item.instanceId && !seen.has(item.instanceId) && seen.add(item.instanceId));
  if (!bindings.length) {
    return [{
      instanceId: draft.instanceId,
      enabled: true,
      isDefault: true,
      executionMode: "selectable" as const,
      capabilityTags: [],
    }];
  }
  if (!bindings.some((item) => item.isDefault)) {
    bindings[0] = { ...bindings[0], isDefault: true };
  }
  return bindings;
}

export function normalizeComfyuiWorkflowDraft(draft: ComfyuiWorkflowDraft): ComfyuiWorkflowDraft {
  const analysis = analyzeComfyuiWorkflow(draft.workflowJson);
  const migrated = migrateLegacyComfyuiWorkflowSchema({
    workflowJson: draft.workflowJson,
    exposedFields: draft.exposedFields,
    hiddenFields: draft.hiddenFields,
    defaultValues: draft.defaultValues,
    outputSchema: draft.outputSchema,
  });
  const inputSchema = draft.inputSchema.length
    ? draft.inputSchema.map((item) => cloneJson(item))
    : migrated.inputSchema.length
      ? migrated.inputSchema.map((item) => cloneJson(item))
      : buildDefaultComfyuiInputSchema(analysis);
  const normalizedInputSchema = inputSchema.map((item, index) => ({
    ...item,
    displayTier: item.mode === "param"
      ? item.displayTier || (index < 4 ? "primary" : "secondary")
      : undefined,
    slotLabel: item.mode === "upstream" ? item.slotLabel || item.label : undefined,
    multiple: item.mode === "upstream" ? item.multiple === true : undefined,
  }));
  const outputSchema = draft.outputSchema.length
    ? draft.outputSchema.map((item) => cloneJson(item))
    : migrated.outputSchema.length
      ? migrated.outputSchema.map((item) => cloneJson(item))
      : buildDefaultComfyuiOutputSchema(analysis);
  const normalizedOutputSchema = outputSchema.map((item, index) => ({
    ...item,
    isPrimary: item.isPrimary === true || (!outputSchema.some((row) => row.isPrimary === true) && index === 0),
  }));
  const defaultValues = Object.fromEntries(
    normalizedInputSchema
      .filter((item) => item.defaultValue !== undefined)
      .map((item) => [item.key, cloneJson(item.defaultValue)]),
  ) as Record<string, unknown>;
  for (const [key, value] of Object.entries(migrated.defaultValues)) {
    if (!Object.prototype.hasOwnProperty.call(defaultValues, key)) {
      defaultValues[key] = cloneJson(value);
    }
  }
  const hiddenFields = normalizedInputSchema.filter((item) => item.mode === "hidden").map((item) => item.key);

  return {
    ...draft,
    analysis,
    inputSchema: normalizedInputSchema,
    exposedFields: buildLegacyExposedFields({ ...draft, inputSchema: normalizedInputSchema }, defaultValues),
    defaultValues,
    hiddenFields,
    outputSchema: normalizedOutputSchema,
    instanceBindings: normalizeInstanceBindings(draft),
  };
}

export function normalizeComfyuiWorkflowDraftList(workflows: ComfyuiWorkflowDraft[]) {
  return workflows.map((workflow) => normalizeComfyuiWorkflowDraft(workflow));
}
