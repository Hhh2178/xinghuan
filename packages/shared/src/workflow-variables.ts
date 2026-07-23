export const WORKFLOW_VARIABLE_TYPES = ["text", "image", "video", "audio", "number", "select"] as const;

export type WorkflowVariableType = typeof WORKFLOW_VARIABLE_TYPES[number];

export interface WorkflowVariableConstraints {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  options?: string[];
}

export interface WorkflowVariableDefinition {
  id: string;
  key: string;
  label: string;
  type: WorkflowVariableType;
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  constraints: WorkflowVariableConstraints;
  allowAiFill: boolean;
  allowAiRewrite: boolean;
  version: number;
}

export interface WorkflowMediaReference {
  kind: "image" | "video" | "audio";
  assetId: string;
}

export type WorkflowTextTemplateSegment =
  | { kind: "text"; value: string }
  | { kind: "variable"; variableId: string; key: string };

export interface WorkflowTextTemplate {
  mode: "fixed" | "variable" | "template";
  source: string;
  segments: WorkflowTextTemplateSegment[];
  variableIds: string[];
}

export type WorkflowFieldBinding =
  | { mode: "fixed" }
  | { mode: "variable"; variableId: string }
  | { mode: "template"; segments: WorkflowTextTemplateSegment[] };

export interface WorkflowInputSnapshotVariable {
  id: string;
  key: string;
  type: WorkflowVariableType;
  value: unknown;
  source: "provided" | "default" | "missing";
}

export interface WorkflowInputSnapshot {
  schemaVersion: 1;
  workflowId: string;
  workflowRevision: number;
  variables: WorkflowInputSnapshotVariable[];
}

export interface WorkflowNodeFieldBinding {
  nodeId: string;
  fieldPath: string;
  fieldType: WorkflowVariableType;
  binding: WorkflowFieldBinding;
}

export interface WorkflowDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  revision: number;
  memberNodeIds: string[];
  variables: WorkflowVariableDefinition[];
  inputValues: Record<string, unknown>;
  bindings: WorkflowNodeFieldBinding[];
}

const RESERVED_VARIABLE_KEYS = new Set([
  "apikey",
  "authorization",
  "baseurl",
  "cookie",
  "filepath",
  "modelrecordid",
  "ownerid",
  "providerid",
  "providerkey",
  "secret",
  "token",
]);

export function normalizeWorkflowVariableName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function validateWorkflowVariableDefinitions(input: readonly WorkflowVariableDefinition[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  return input.map((definition) => {
    const id = boundedText(definition.id, 160);
    const key = boundedText(definition.key, 80);
    const normalizedName = normalizeWorkflowVariableName(key);
    if (!id) throw new Error("WORKFLOW_VARIABLE_ID_REQUIRED");
    if (ids.has(id)) throw new Error(`WORKFLOW_VARIABLE_ID_CONFLICT:${id}`);
    if (!normalizedName) throw new Error("WORKFLOW_VARIABLE_KEY_REQUIRED");
    if (names.has(normalizedName)) throw new Error(`WORKFLOW_VARIABLE_NAME_CONFLICT:${normalizedName}`);
    if (isReservedVariableKey(normalizedName)) throw new Error(`WORKFLOW_VARIABLE_KEY_RESERVED:${key}`);
    if (!WORKFLOW_VARIABLE_TYPES.includes(definition.type)) throw new Error(`WORKFLOW_VARIABLE_TYPE_INVALID:${String(definition.type)}`);
    ids.add(id);
    names.add(normalizedName);
    const constraints = normalizeConstraints(definition.type, definition.constraints);
    const normalized: WorkflowVariableDefinition = {
      id,
      key,
      label: boundedText(definition.label, 120) || key,
      type: definition.type,
      required: definition.required === true,
      description: boundedText(definition.description, 1_000) || undefined,
      constraints,
      allowAiFill: definition.allowAiFill === true,
      allowAiRewrite: definition.type === "text" && definition.allowAiRewrite === true,
      version: positiveInteger(definition.version, "WORKFLOW_VARIABLE_VERSION_INVALID"),
    };
    if (definition.defaultValue !== undefined && definition.defaultValue !== null) {
      normalized.defaultValue = validateWorkflowVariableValue(normalized, definition.defaultValue);
    }
    return normalized;
  });
}

export function normalizeWorkflowDocuments(input: unknown): WorkflowDocument[] {
  if (!Array.isArray(input)) return [];
  const workflowIds = new Set<string>();
  return input.map((raw) => {
    if (!isRecord(raw)) throw new Error("WORKFLOW_DOCUMENT_INVALID");
    const id = boundedText(raw.id, 160);
    if (!id) throw new Error("WORKFLOW_ID_REQUIRED");
    if (workflowIds.has(id)) throw new Error(`WORKFLOW_ID_CONFLICT:${id}`);
    workflowIds.add(id);
    const name = boundedText(raw.name, 160) || "未命名工作流";
    const revision = positiveInteger(raw.revision, "WORKFLOW_REVISION_INVALID");
    const memberNodeIds = uniqueBoundedStrings(raw.memberNodeIds, 160);
    const memberIds = new Set(memberNodeIds);
    const variables = validateWorkflowVariableDefinitions(Array.isArray(raw.variables) ? raw.variables as WorkflowVariableDefinition[] : []);
    const variablesById = new Map(variables.map((variable) => [variable.id, variable]));
    const inputValues: Record<string, unknown> = {};
    const rawValues = isRecord(raw.inputValues) ? raw.inputValues : {};
    for (const [variableId, value] of Object.entries(rawValues)) {
      const definition = variablesById.get(variableId);
      if (!definition) throw new Error(`WORKFLOW_INPUT_VALUE_VARIABLE_UNKNOWN:${variableId}`);
      if (value === undefined || value === null) continue;
      inputValues[variableId] = validateWorkflowVariableValue(definition, value);
    }

    const bindingKeys = new Set<string>();
    const bindings = (Array.isArray(raw.bindings) ? raw.bindings : []).map((rawBinding): WorkflowNodeFieldBinding => {
      if (!isRecord(rawBinding) || !isRecord(rawBinding.binding)) throw new Error("WORKFLOW_BINDING_INVALID");
      const nodeId = boundedText(rawBinding.nodeId, 160);
      const fieldPath = boundedText(rawBinding.fieldPath, 240);
      const fieldType = rawBinding.fieldType as WorkflowVariableType;
      if (!nodeId || !fieldPath) throw new Error("WORKFLOW_BINDING_TARGET_REQUIRED");
      if (!memberIds.has(nodeId)) throw new Error(`WORKFLOW_BINDING_NODE_OUTSIDE:${nodeId}`);
      if (!WORKFLOW_VARIABLE_TYPES.includes(fieldType)) throw new Error(`WORKFLOW_BINDING_FIELD_TYPE_INVALID:${String(fieldType)}`);
      const targetKey = `${nodeId}\u0000${fieldPath}`;
      if (bindingKeys.has(targetKey)) throw new Error(`WORKFLOW_BINDING_TARGET_CONFLICT:${nodeId}:${fieldPath}`);
      bindingKeys.add(targetKey);
      return {
        nodeId,
        fieldPath,
        fieldType,
        binding: normalizeWorkflowFieldBinding(rawBinding.binding, fieldType, variablesById),
      };
    });

    return { schemaVersion: 1, id, name, revision, memberNodeIds, variables, inputValues, bindings };
  });
}

export function collectWorkflowVariableReferences(workflow: WorkflowDocument): Record<string, string[]> {
  const references: Record<string, string[]> = {};
  for (const binding of workflow.bindings) {
    for (const variableId of bindingVariableIds(binding.binding)) {
      const nodeIds = references[variableId] || [];
      if (!nodeIds.includes(binding.nodeId)) nodeIds.push(binding.nodeId);
      references[variableId] = nodeIds;
    }
  }
  return references;
}

export function parseWorkflowTextTemplate(source: string, definitions: readonly WorkflowVariableDefinition[]): WorkflowTextTemplate {
  const variables = validateWorkflowVariableDefinitions(definitions);
  const byName = new Map(variables.map((definition) => [normalizeWorkflowVariableName(definition.key), definition]));
  const segments: WorkflowTextTemplateSegment[] = [];
  const variableIds: string[] = [];
  let text = "";
  let index = 0;

  const flushText = () => {
    if (!text) return;
    const previous = segments.at(-1);
    if (previous?.kind === "text") previous.value += text;
    else segments.push({ kind: "text", value: text });
    text = "";
  };

  while (index < source.length) {
    if (source.startsWith("\\##", index)) {
      const literalClosing = findClosingTokenMarker(source, index + 3);
      if (literalClosing >= 0) {
        text += source.slice(index + 1, literalClosing + 2);
        index = literalClosing + 2;
      } else {
        text += "##";
        index += 3;
      }
      continue;
    }
    if (!source.startsWith("##", index)) {
      text += source[index];
      index += 1;
      continue;
    }
    flushText();
    const closing = findClosingTokenMarker(source, index + 2);
    if (closing < 0) throw new Error("WORKFLOW_VARIABLE_TOKEN_UNCLOSED");
    const tokenName = source.slice(index + 2, closing);
    const normalizedName = normalizeWorkflowVariableName(tokenName);
    if (!normalizedName) throw new Error("WORKFLOW_VARIABLE_TOKEN_EMPTY");
    const definition = byName.get(normalizedName);
    if (!definition) throw new Error(`WORKFLOW_VARIABLE_TOKEN_UNKNOWN:${tokenName.trim()}`);
    if (definition.type !== "text") throw new Error(`WORKFLOW_VARIABLE_TEMPLATE_TYPE_MISMATCH:${definition.key}:${definition.type}`);
    segments.push({ kind: "variable", variableId: definition.id, key: definition.key });
    if (!variableIds.includes(definition.id)) variableIds.push(definition.id);
    index = closing + 2;
  }
  flushText();

  const mode = variableIds.length === 0
    ? "fixed"
    : segments.length === 1 && segments[0]?.kind === "variable"
      ? "variable"
      : "template";
  return { mode, source, segments, variableIds };
}

export function extractWorkflowVariableTokenNames(source: string) {
  const names: string[] = [];
  const normalizedNames = new Set<string>();
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\##", index)) {
      const literalClosing = findClosingTokenMarker(source, index + 3);
      index = literalClosing >= 0 ? literalClosing + 2 : index + 3;
      continue;
    }
    if (!source.startsWith("##", index)) {
      index += 1;
      continue;
    }
    const closing = findClosingTokenMarker(source, index + 2);
    if (closing < 0) break;
    const name = source.slice(index + 2, closing).trim();
    const normalized = normalizeWorkflowVariableName(name);
    if (normalized && !normalizedNames.has(normalized)) {
      normalizedNames.add(normalized);
      names.push(name);
    }
    index = closing + 2;
  }
  return names;
}

export function renameWorkflowVariableToken(source: string, currentKey: string, nextKey: string) {
  const normalizedCurrentKey = normalizeWorkflowVariableName(currentKey);
  const boundedNextKey = boundedText(nextKey, 80);
  if (!normalizedCurrentKey || !boundedNextKey) throw new Error("WORKFLOW_VARIABLE_KEY_REQUIRED");
  let result = "";
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("\\##", index)) {
      const literalClosing = findClosingTokenMarker(source, index + 3);
      const end = literalClosing >= 0 ? literalClosing + 2 : index + 3;
      result += source.slice(index, end);
      index = end;
      continue;
    }
    if (!source.startsWith("##", index)) {
      result += source[index];
      index += 1;
      continue;
    }
    const closing = findClosingTokenMarker(source, index + 2);
    if (closing < 0) {
      result += source.slice(index);
      break;
    }
    const tokenName = source.slice(index + 2, closing);
    result += normalizeWorkflowVariableName(tokenName) === normalizedCurrentKey
      ? `##${boundedNextKey}##`
      : source.slice(index, closing + 2);
    index = closing + 2;
  }
  return result;
}

export function createWorkflowInputSnapshot(input: {
  workflowId: string;
  workflowRevision: number;
  variables: readonly WorkflowVariableDefinition[];
  values: Readonly<Record<string, unknown>>;
}): WorkflowInputSnapshot {
  const workflowId = boundedText(input.workflowId, 160);
  if (!workflowId) throw new Error("WORKFLOW_INPUT_SNAPSHOT_WORKFLOW_REQUIRED");
  const workflowRevision = positiveInteger(input.workflowRevision, "WORKFLOW_INPUT_SNAPSHOT_REVISION_INVALID");
  const definitions = validateWorkflowVariableDefinitions(input.variables);
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const definitionNames = new Set(definitions.map((definition) => normalizeWorkflowVariableName(definition.key)));
  const providedByName = new Map<string, unknown>();
  for (const [key, value] of Object.entries(input.values || {})) {
    const normalizedKey = normalizeWorkflowVariableName(key);
    if (!definitionIds.has(key) && !definitionNames.has(normalizedKey)) {
      throw new Error(`WORKFLOW_VARIABLE_VALUE_UNKNOWN:${key}`);
    }
    providedByName.set(normalizedKey, value);
  }
  const variables = definitions.map((definition): WorkflowInputSnapshotVariable => {
    const hasId = Object.prototype.hasOwnProperty.call(input.values, definition.id);
    const normalizedKey = normalizeWorkflowVariableName(definition.key);
    const hasKey = providedByName.has(normalizedKey);
    const provided = hasId ? input.values[definition.id] : providedByName.get(normalizedKey);
    if (hasId || hasKey) {
      return { id: definition.id, key: definition.key, type: definition.type, value: validateWorkflowVariableValue(definition, provided), source: "provided" };
    }
    if (definition.defaultValue !== undefined) {
      return { id: definition.id, key: definition.key, type: definition.type, value: cloneValue(definition.defaultValue), source: "default" };
    }
    if (definition.required) throw new Error(`WORKFLOW_VARIABLE_VALUE_REQUIRED:${definition.key}`);
    return { id: definition.id, key: definition.key, type: definition.type, value: null, source: "missing" };
  });
  return deepFreeze({ schemaVersion: 1, workflowId, workflowRevision, variables });
}

export function workflowTextTemplateBinding(template: WorkflowTextTemplate): WorkflowFieldBinding {
  if (template.mode === "fixed") return { mode: "fixed" };
  if (template.mode === "variable") {
    const segment = template.segments[0];
    if (segment?.kind !== "variable") throw new Error("WORKFLOW_VARIABLE_BINDING_INVALID");
    return { mode: "variable", variableId: segment.variableId };
  }
  return { mode: "template", segments: template.segments.map((segment) => ({ ...segment })) };
}

export function resolveWorkflowFieldBinding(input: {
  fieldType: WorkflowVariableType;
  binding: WorkflowFieldBinding;
  fixedValue: unknown;
  snapshot: WorkflowInputSnapshot;
}) {
  if (input.binding.mode === "fixed") return cloneValue(input.fixedValue);
  const values = new Map(input.snapshot.variables.map((variable) => [variable.id, variable]));
  if (input.binding.mode === "variable") {
    const variable = values.get(input.binding.variableId);
    if (!variable) throw new Error(`WORKFLOW_VARIABLE_BINDING_UNKNOWN:${input.binding.variableId}`);
    if (variable.type !== input.fieldType) throw new Error(`WORKFLOW_VARIABLE_BINDING_TYPE_MISMATCH:${input.binding.variableId}:${input.fieldType}`);
    if (variable.source === "missing") throw new Error(`WORKFLOW_VARIABLE_BINDING_VALUE_MISSING:${variable.key}`);
    return cloneValue(variable.value);
  }
  if (input.fieldType !== "text") throw new Error(`WORKFLOW_VARIABLE_TEMPLATE_FIELD_TYPE_MISMATCH:${input.fieldType}`);
  return input.binding.segments.map((segment) => {
    if (segment.kind === "text") return segment.value;
    const variable = values.get(segment.variableId);
    if (!variable) throw new Error(`WORKFLOW_VARIABLE_BINDING_UNKNOWN:${segment.variableId}`);
    if (variable.type !== "text") throw new Error(`WORKFLOW_VARIABLE_BINDING_TYPE_MISMATCH:${segment.variableId}:text`);
    if (variable.source === "missing") throw new Error(`WORKFLOW_VARIABLE_BINDING_VALUE_MISSING:${variable.key}`);
    return String(variable.value);
  }).join("");
}

export function validateWorkflowVariableValue(definition: WorkflowVariableDefinition, value: unknown): unknown {
  if (definition.type === "text") {
    if (typeof value !== "string") throw typeMismatch(definition);
    const length = Array.from(value).length;
    if (definition.constraints.minLength !== undefined && length < definition.constraints.minLength) {
      throw new Error(`WORKFLOW_VARIABLE_VALUE_MIN_LENGTH:${definition.key}:${definition.constraints.minLength}`);
    }
    if (definition.constraints.maxLength !== undefined && length > definition.constraints.maxLength) {
      throw new Error(`WORKFLOW_VARIABLE_VALUE_MAX_LENGTH:${definition.key}:${definition.constraints.maxLength}`);
    }
    return value;
  }
  if (definition.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw typeMismatch(definition);
    if (definition.constraints.minimum !== undefined && value < definition.constraints.minimum) {
      throw new Error(`WORKFLOW_VARIABLE_VALUE_MINIMUM:${definition.key}:${definition.constraints.minimum}`);
    }
    if (definition.constraints.maximum !== undefined && value > definition.constraints.maximum) {
      throw new Error(`WORKFLOW_VARIABLE_VALUE_MAXIMUM:${definition.key}:${definition.constraints.maximum}`);
    }
    return value;
  }
  if (definition.type === "select") {
    if (typeof value !== "string") throw typeMismatch(definition);
    const options = definition.constraints.options || [];
    if (!options.includes(value)) throw new Error(`WORKFLOW_VARIABLE_VALUE_OPTION_INVALID:${definition.key}:${value}`);
    return value;
  }
  if (!isRecord(value) || value.kind !== definition.type || typeof value.assetId !== "string" || !value.assetId.trim()) {
    throw typeMismatch(definition);
  }
  return { kind: definition.type, assetId: value.assetId.trim() } satisfies WorkflowMediaReference;
}

function normalizeConstraints(type: WorkflowVariableType, input: WorkflowVariableConstraints | undefined): WorkflowVariableConstraints {
  const source = isRecord(input) ? input : {};
  if (type === "text") {
    const minLength = optionalNonNegativeInteger(source.minLength);
    const maxLength = optionalNonNegativeInteger(source.maxLength);
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) throw new Error("WORKFLOW_VARIABLE_CONSTRAINT_RANGE_INVALID");
    return { minLength, maxLength };
  }
  if (type === "number") {
    const minimum = optionalFiniteNumber(source.minimum);
    const maximum = optionalFiniteNumber(source.maximum);
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) throw new Error("WORKFLOW_VARIABLE_CONSTRAINT_RANGE_INVALID");
    return { minimum, maximum };
  }
  if (type === "select") {
    const options = [...new Set(Array.isArray(source.options) ? source.options.map((item) => boundedText(item, 200)).filter(Boolean) : [])];
    if (options.length === 0) throw new Error("WORKFLOW_VARIABLE_SELECT_OPTIONS_REQUIRED");
    return { options };
  }
  return {};
}

function normalizeWorkflowFieldBinding(
  input: Record<string, unknown>,
  fieldType: WorkflowVariableType,
  variablesById: ReadonlyMap<string, WorkflowVariableDefinition>,
): WorkflowFieldBinding {
  if (input.mode === "fixed") return { mode: "fixed" };
  if (input.mode === "variable") {
    const variableId = boundedText(input.variableId, 160);
    const variable = variablesById.get(variableId);
    if (!variable) throw new Error(`WORKFLOW_BINDING_VARIABLE_UNKNOWN:${variableId}`);
    if (variable.type !== fieldType) throw new Error(`WORKFLOW_BINDING_TYPE_MISMATCH:${variableId}:${fieldType}`);
    return { mode: "variable", variableId };
  }
  if (input.mode !== "template" || fieldType !== "text" || !Array.isArray(input.segments)) {
    throw new Error("WORKFLOW_BINDING_INVALID");
  }
  const segments = input.segments.map((segment): WorkflowTextTemplateSegment => {
    if (!isRecord(segment)) throw new Error("WORKFLOW_BINDING_TEMPLATE_SEGMENT_INVALID");
    if (segment.kind === "text") return { kind: "text", value: typeof segment.value === "string" ? segment.value : "" };
    if (segment.kind !== "variable") throw new Error("WORKFLOW_BINDING_TEMPLATE_SEGMENT_INVALID");
    const variableId = boundedText(segment.variableId, 160);
    const variable = variablesById.get(variableId);
    if (!variable) throw new Error(`WORKFLOW_BINDING_VARIABLE_UNKNOWN:${variableId}`);
    if (variable.type !== "text") throw new Error(`WORKFLOW_BINDING_TYPE_MISMATCH:${variableId}:text`);
    return { kind: "variable", variableId, key: variable.key };
  });
  return { mode: "template", segments };
}

function bindingVariableIds(binding: WorkflowFieldBinding) {
  if (binding.mode === "fixed") return [];
  if (binding.mode === "variable") return [binding.variableId];
  return [...new Set(binding.segments.flatMap((segment) => segment.kind === "variable" ? [segment.variableId] : []))];
}

function findClosingTokenMarker(source: string, start: number) {
  for (let index = start; index < source.length - 1; index += 1) {
    if (source.startsWith("\\##", index)) {
      index += 2;
      continue;
    }
    if (source.startsWith("##", index)) return index;
  }
  return -1;
}

function isReservedVariableKey(normalizedName: string) {
  const compact = normalizedName.replace(/[\s._-]+/g, "");
  return RESERVED_VARIABLE_KEYS.has(compact);
}

function typeMismatch(definition: WorkflowVariableDefinition) {
  return new Error(`WORKFLOW_VARIABLE_VALUE_TYPE_MISMATCH:${definition.key}:${definition.type}`);
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function positiveInteger(value: unknown, code: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(code);
  return parsed;
}

function optionalNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("WORKFLOW_VARIABLE_CONSTRAINT_INTEGER_INVALID");
  return parsed;
}

function optionalFiniteNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("WORKFLOW_VARIABLE_CONSTRAINT_NUMBER_INVALID");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueBoundedStrings(value: unknown, maximum: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => boundedText(item, maximum)).filter(Boolean))];
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
