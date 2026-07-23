import { describe, expect, it, vi } from "vitest";

import { createAgentKnowledgeTools } from "./agent-knowledge-tools.js";

describe("Agent knowledge and workflow tools", () => {
  it("queries the locked snapshot and keeps document retrieval inside fixed constraints", async () => {
    const readSnapshot = vi.fn(async () => ({
      id: "snapshot-1",
      environment: "gray",
      audience: "public",
      nodes: [{ nodeType: "image", label: "Image" }],
      models: [{ id: "model-1", modelId: "chat-model", compatibleNodeTypes: ["llm"], llmEligible: true }],
      documents: [{ publicationId: "pub-1", documentId: "doc-1", documentKey: "image", collectionKey: "public-canvas", audience: "public", environment: "gray", version: 1, title: "Image", body: "image prompt guide", bodyHash: "hash" }],
    } as any));
    const tools = createAgentKnowledgeTools({
      snapshots: { readSnapshot },
      readWorkflow: vi.fn(async () => ({ revisionId: "rev-1", nodes: [{ id: "image-1", type: "image" }], edges: [] })),
      constraints: { environment: "gray", audience: "public", collectionAllowlist: ["public-canvas"], topK: 3, tokenBudget: 100 },
    });
    const context = { ownerId: "owner-1", taskId: "task-1" };

    await expect(tool(tools, "knowledge.node.get").execute({ snapshotId: "snapshot-1", nodeType: "image" }, context)).resolves.toMatchObject({ nodeType: "image" });
    await expect(tool(tools, "knowledge.model.get").execute({ snapshotId: "snapshot-1", modelId: "chat-model" }, context)).resolves.toMatchObject({ id: "model-1" });
    await expect(tool(tools, "knowledge.documents.search").execute({ snapshotId: "snapshot-1", query: "image prompt", collectionAllowlist: ["internal-ops"], topK: 99 }, context)).resolves.toMatchObject({
      items: [{ documentKey: "image", citation: "knowledge://public-canvas/image@1" }],
    });
    expect(readSnapshot).toHaveBeenCalledWith({ ownerId: "owner-1", snapshotId: "snapshot-1" });
  });

  it("provides read-only workflow inspection and approval-bound patch previews", async () => {
    const workflow = { revisionId: "rev-1", nodes: [{ id: "text-1", type: "text" }], edges: [] };
    const tools = createAgentKnowledgeTools({
      snapshots: { readSnapshot: vi.fn() },
      readWorkflow: vi.fn(async () => workflow),
      constraints: { environment: "gray", audience: "internal", collectionAllowlist: [], topK: 3, tokenBudget: 100 },
    });
    const context = { ownerId: "owner-1", taskId: "task-1" };
    await expect(tool(tools, "canvas.workflow.inspect").execute({ revisionId: "rev-1" }, context)).resolves.toEqual(workflow);
    await expect(tool(tools, "canvas.workflow.search").execute({ revisionId: "rev-1", query: "text" }, context)).resolves.toEqual({ nodes: workflow.nodes, edges: [] });
    await expect(tool(tools, "canvas.workflow.validate").execute({ revisionId: "rev-1" }, context)).resolves.toEqual({ valid: true, issues: [] });
    const proposalTool = tool(tools, "canvas.patch.propose");
    expect(proposalTool.approvalRequired).toBe(true);
    await expect(proposalTool.execute({ revisionId: "rev-1", reason: "Add output", operations: [{ operation: "add-node", node: { id: "output-1", type: "output" } }] }, context)).resolves.toMatchObject({ approvalRequired: true, appliesAutomatically: false, preview: { after: { nodes: [{ id: "text-1" }, { id: "output-1" }] } } });
  });
});

function tool(tools: ReturnType<typeof createAgentKnowledgeTools>, name: string) {
  const definition = tools.find((candidate) => candidate.name === name);
  if (!definition) throw new Error(`missing tool ${name}`);
  return definition;
}
