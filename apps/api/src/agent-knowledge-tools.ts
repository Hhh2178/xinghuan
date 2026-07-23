import {
  proposeWorkflowPatch,
  queryAgentModels,
  retrieveKnowledgeDocuments,
  validateWorkflowSnapshot,
  type KnowledgeAudience,
  type KnowledgeEnvironment,
  type WorkflowPatchOperation,
  type WorkflowSnapshot,
} from "@xinghuan/agent-core";

import type { AgentKnowledgeSnapshotRecord } from "./agent-knowledge-snapshot-repository.js";
import type { AgentToolDefinition } from "./agent-tool-gateway.js";

export function createAgentKnowledgeTools(deps: {
  snapshots: { readSnapshot(input: { ownerId: string; snapshotId: string }): Promise<AgentKnowledgeSnapshotRecord> };
  readWorkflow(input: { ownerId: string; revisionId: string }): Promise<WorkflowSnapshot>;
  constraints: {
    environment: KnowledgeEnvironment;
    audience: KnowledgeAudience;
    collectionAllowlist: string[];
    topK: number;
    tokenBudget: number;
  };
}): AgentToolDefinition[] {
  const readLockedSnapshot = async (payload: Record<string, unknown>, ownerId: string) => {
    const snapshot = await deps.snapshots.readSnapshot({ ownerId, snapshotId: requiredString(payload.snapshotId, "KNOWLEDGE_SNAPSHOT_ID_REQUIRED") });
    if (snapshot.environment !== deps.constraints.environment || snapshot.audience !== deps.constraints.audience) {
      throw new Error("AGENT_KNOWLEDGE_SNAPSHOT_BOUNDARY_MISMATCH");
    }
    return snapshot;
  };
  const readWorkflow = (payload: Record<string, unknown>, ownerId: string) => deps.readWorkflow({
    ownerId,
    revisionId: requiredString(payload.revisionId, "CANVAS_REVISION_ID_REQUIRED"),
  });

  return [
    definition("knowledge.node.get", false, async (payload, context) => {
      const snapshot = await readLockedSnapshot(payload, context.ownerId);
      const nodeType = requiredString(payload.nodeType, "KNOWLEDGE_NODE_TYPE_REQUIRED");
      const node = snapshot.nodes.find((candidate) => candidate.nodeType === nodeType);
      if (!node) throw new Error("KNOWLEDGE_NODE_NOT_FOUND");
      return node;
    }),
    definition("knowledge.model.get", false, async (payload, context) => {
      const snapshot = await readLockedSnapshot(payload, context.ownerId);
      const modelId = requiredString(payload.modelId, "KNOWLEDGE_MODEL_ID_REQUIRED");
      const matches = queryAgentModels(snapshot.models, { exactId: modelId });
      const model = matches[0] || queryAgentModels(snapshot.models, { exactModelId: modelId })[0];
      if (!model) throw new Error("KNOWLEDGE_MODEL_NOT_FOUND");
      return model;
    }),
    definition("knowledge.model.search", false, async (payload, context) => {
      const snapshot = await readLockedSnapshot(payload, context.ownerId);
      return queryAgentModels(snapshot.models, {
        compatibleNodeType: optionalString(payload.compatibleNodeType),
        llmEligible: optionalBoolean(payload.llmEligible),
        enabled: optionalBoolean(payload.enabled),
      }).slice(0, 50);
    }),
    definition("knowledge.documents.search", false, async (payload, context) => {
      const snapshot = await readLockedSnapshot(payload, context.ownerId);
      return retrieveKnowledgeDocuments(snapshot.documents, {
        query: optionalString(payload.query) || "",
        collectionAllowlist: deps.constraints.collectionAllowlist,
        audience: deps.constraints.audience,
        environment: deps.constraints.environment,
        topK: deps.constraints.topK,
        tokenBudget: deps.constraints.tokenBudget,
      });
    }),
    definition("canvas.workflow.inspect", false, (payload, context) => readWorkflow(payload, context.ownerId)),
    definition("canvas.workflow.search", false, async (payload, context) => {
      const workflow = await readWorkflow(payload, context.ownerId);
      const query = requiredString(payload.query, "CANVAS_WORKFLOW_QUERY_REQUIRED").toLocaleLowerCase();
      const nodes = workflow.nodes.filter((node) => `${node.id} ${node.type}`.toLocaleLowerCase().includes(query));
      const nodeIds = new Set(nodes.map((node) => node.id));
      const edges = workflow.edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));
      return { nodes, edges };
    }),
    definition("canvas.workflow.validate", false, async (payload, context) => validateWorkflowSnapshot(await readWorkflow(payload, context.ownerId))),
    definition("canvas.patch.propose", true, async (payload, context) => proposeWorkflowPatch({
      workflow: await readWorkflow(payload, context.ownerId),
      operations: workflowOperations(payload.operations),
      reason: requiredString(payload.reason, "CANVAS_PATCH_REASON_REQUIRED"),
    })),
  ];
}

function definition(
  name: string,
  approvalRequired: boolean,
  execute: AgentToolDefinition["execute"],
): AgentToolDefinition {
  return { name, approvalRequired, execute };
}

function requiredString(value: unknown, code: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(code);
  return text;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function workflowOperations(value: unknown): WorkflowPatchOperation[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("CANVAS_PATCH_OPERATIONS_INVALID");
  return value.map((item) => {
    const operation = record(item);
    if (operation.operation === "add-node") {
      const node = record(operation.node);
      return { operation: "add-node" as const, node: { ...node, id: requiredString(node.id, "CANVAS_PATCH_NODE_ID_REQUIRED"), type: requiredString(node.type, "CANVAS_PATCH_NODE_TYPE_REQUIRED") } };
    }
    if (operation.operation === "remove-node") return { operation: "remove-node" as const, nodeId: requiredString(operation.nodeId, "CANVAS_PATCH_NODE_ID_REQUIRED") };
    if (operation.operation === "add-edge") {
      const edge = record(operation.edge);
      return { operation: "add-edge" as const, edge: { ...edge, id: requiredString(edge.id, "CANVAS_PATCH_EDGE_ID_REQUIRED"), source: requiredString(edge.source, "CANVAS_PATCH_EDGE_SOURCE_REQUIRED"), target: requiredString(edge.target, "CANVAS_PATCH_EDGE_TARGET_REQUIRED") } };
    }
    if (operation.operation === "remove-edge") return { operation: "remove-edge" as const, edgeId: requiredString(operation.edgeId, "CANVAS_PATCH_EDGE_ID_REQUIRED") };
    throw new Error("CANVAS_PATCH_OPERATION_UNSUPPORTED");
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
