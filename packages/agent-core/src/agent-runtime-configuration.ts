import { AGENT_TOOL_CATALOG } from "./agent-tool-catalog.js";

export interface AgentRuntimeConfiguration {
  promptTemplate: string;
  roleDescription: string;
  llmPoolKey: string;
  knowledge: {
    collectionAllowlist: string[];
    audience: "public" | "internal";
    topK: number;
    tokenBudget: number;
  };
  toolAllowlist: string[];
  maxTokens: number;
  timeoutMs: number;
  budget: { maximumEstimatedCost: number | null };
  approvalPolicy: {
    structuralChanges: "required";
    generationModelSwitch: "required" | "policy";
  };
  automaticRecovery: { enabled: boolean; maxAttempts: number };
  qualityProfileKey: string;
}

const knownTools = new Set(AGENT_TOOL_CATALOG.map((tool) => tool.name));

export function normalizeAgentRuntimeConfiguration(value: unknown): AgentRuntimeConfiguration {
  const source = record(value);
  const knowledge = record(source.knowledge);
  const budget = record(source.budget);
  const approval = record(source.approvalPolicy);
  const recovery = record(source.automaticRecovery);
  const toolAllowlist = uniqueStrings(source.toolAllowlist).sort();
  const unknownTool = toolAllowlist.find((tool) => !knownTools.has(tool));
  if (unknownTool) throw new Error(`AGENT_CONFIGURATION_TOOL_UNKNOWN:${unknownTool}`);
  if (approval.structuralChanges !== undefined && approval.structuralChanges !== "required") {
    throw new Error("AGENT_CONFIGURATION_STRUCTURAL_APPROVAL_REQUIRED");
  }
  const generationModelSwitch = approval.generationModelSwitch === "policy" ? "policy" : "required";
  const maximumEstimatedCost = budget.maximumEstimatedCost === null || budget.maximumEstimatedCost === undefined
    ? null
    : boundedNumber(budget.maximumEstimatedCost, 0, 1_000_000, 0);
  return {
    promptTemplate: boundedText(source.promptTemplate, 40_000),
    roleDescription: boundedText(source.roleDescription, 2_000),
    llmPoolKey: boundedText(source.llmPoolKey, 200),
    knowledge: {
      collectionAllowlist: uniqueStrings(knowledge.collectionAllowlist).slice(0, 20).sort(),
      audience: knowledge.audience === "public" ? "public" : "internal",
      topK: boundedInteger(knowledge.topK, 1, 20, 8),
      tokenBudget: boundedInteger(knowledge.tokenBudget, 128, 32_000, 4_000),
    },
    toolAllowlist,
    maxTokens: boundedInteger(source.maxTokens, 128, 64_000, 4_000),
    timeoutMs: boundedInteger(source.timeoutMs, 1_000, 600_000, 120_000),
    budget: { maximumEstimatedCost },
    approvalPolicy: { structuralChanges: "required", generationModelSwitch },
    automaticRecovery: {
      enabled: recovery.enabled === true,
      maxAttempts: boundedInteger(recovery.maxAttempts, 0, 20, 2),
    },
    qualityProfileKey: boundedText(source.qualityProfileKey, 200),
  };
}

export function renderAgentPromptTemplate(template: string, input: { role: string; scenario: string }) {
  return template.replaceAll("{{role}}", input.role).replaceAll("{{scenario}}", input.scenario).trim();
}

export function diffAgentRuntimeConfiguration(before: AgentRuntimeConfiguration, after: AgentRuntimeConfiguration) {
  const left = comparableFields(before);
  const right = comparableFields(after);
  return Object.keys(left).sort().flatMap((field) => equal(left[field], right[field]) ? [] : [{ field, before: left[field], after: right[field] }]);
}

function comparableFields(value: AgentRuntimeConfiguration): Record<string, unknown> {
  return {
    "approvalPolicy.generationModelSwitch": value.approvalPolicy.generationModelSwitch,
    "approvalPolicy.structuralChanges": value.approvalPolicy.structuralChanges,
    "automaticRecovery.enabled": value.automaticRecovery.enabled,
    "automaticRecovery.maxAttempts": value.automaticRecovery.maxAttempts,
    "budget.maximumEstimatedCost": value.budget.maximumEstimatedCost,
    "knowledge.audience": value.knowledge.audience,
    "knowledge.collectionAllowlist": value.knowledge.collectionAllowlist,
    "knowledge.tokenBudget": value.knowledge.tokenBudget,
    "knowledge.topK": value.knowledge.topK,
    llmPoolKey: value.llmPoolKey,
    maxTokens: value.maxTokens,
    promptTemplate: value.promptTemplate,
    qualityProfileKey: value.qualityProfileKey,
    roleDescription: value.roleDescription,
    timeoutMs: value.timeoutMs,
    toolAllowlist: value.toolAllowlist,
  };
}

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function uniqueStrings(value: unknown) {
  return [...new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [])];
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}
