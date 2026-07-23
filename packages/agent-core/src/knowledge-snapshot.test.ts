import { describe, expect, it } from "vitest";

import {
  buildKnowledgeSnapshotCanonicalValue,
  projectAgentModelCatalog,
  proposeWorkflowPatch,
  queryAgentModels,
  retrieveKnowledgeDocuments,
  validateWorkflowSnapshot,
} from "./index.js";

describe("curated Agent knowledge", () => {
  it("builds a safe model projection without Provider secrets or raw advanced config", () => {
    const projection = projectAgentModelCatalog([{
      id: "model-chat",
      modelId: "gpt-test",
      displayName: "GPT Test",
      capability: "chat",
      providerId: "provider-openai",
      providerName: "OpenAI",
      providerProtocol: "openai",
      enabled: true,
      providerEnabled: true,
      inputProfile: "multimodal",
      inputCapabilities: { text: true, image: true },
      capabilityTags: ["text_chat", "image_understanding"],
      parameterSchema: "chat-v1",
      testState: { state: "healthy", p95LatencyMs: 320 },
      baseUrl: "https://secret.invalid",
      apiKey: "must-not-project",
      advancedConfig: { authorization: "must-not-project" },
    } as any]);

    expect(projection).toEqual([expect.objectContaining({
      id: "model-chat",
      purpose: "chat",
      compatibleNodeTypes: expect.arrayContaining(["llm"]),
      llmEligible: true,
      health: expect.objectContaining({ state: "healthy" }),
    })]);
    expect(JSON.stringify(projection)).not.toContain("secret.invalid");
    expect(JSON.stringify(projection)).not.toContain("must-not-project");
    expect(queryAgentModels(projection, { exactModelId: "gpt-test" })).toHaveLength(1);
    expect(queryAgentModels(projection, { compatibleNodeType: "image" })).toHaveLength(0);
  });

  it("filters documents before bounded retrieval and emits stable citations", () => {
    const result = retrieveKnowledgeDocuments([
      document("gray-public", "public-canvas", "public", "gray", "image prompt lighting"),
      document("internal", "internal-ops", "internal", "gray", "image prompt private"),
      document("production", "public-canvas", "public", "production", "image prompt prod"),
      document("other", "other-public", "public", "gray", "image prompt other"),
      document("weak", "public-canvas", "public", "gray", "unrelated words"),
    ], {
      query: "image prompt",
      collectionAllowlist: ["public-canvas"],
      audience: "public",
      environment: "gray",
      topK: 2,
      tokenBudget: 20,
    });

    expect(result.items.map((item) => item.documentKey)).toEqual(["gray-public"]);
    expect(result.items[0]?.citation).toEqual("knowledge://public-canvas/gray-public@1");
    expect(result.totalEstimatedTokens).toBeLessThanOrEqual(20);
  });

  it("canonicalizes snapshot inputs independently of source ordering", () => {
    const common = {
      environment: "gray" as const,
      audience: "public" as const,
      nodeCatalogVersion: "v1",
      nodeCatalogHash: "node-hash",
      modelCatalogRevision: "2026-07-23T00:00:00.000Z",
      modelCatalogHash: "model-hash",
    };
    const first = buildKnowledgeSnapshotCanonicalValue({
      ...common,
      documentPublications: [publication("b"), publication("a")],
      workflowTemplates: [template("z"), template("a")],
    });
    const second = buildKnowledgeSnapshotCanonicalValue({
      ...common,
      documentPublications: [publication("a"), publication("b")],
      workflowTemplates: [template("a"), template("z")],
    });
    expect(first).toEqual(second);
  });

  it("validates workflow structure and makes structural patches approval-bound previews", () => {
    const workflow = {
      revisionId: "rev-1",
      nodes: [{ id: "text-1", type: "text" }, { id: "image-1", type: "image" }],
      edges: [{ id: "edge-1", source: "text-1", target: "image-1" }],
    };
    expect(validateWorkflowSnapshot(workflow)).toEqual({ valid: true, issues: [] });
    expect(validateWorkflowSnapshot({ ...workflow, edges: [{ id: "bad", source: "missing", target: "image-1" }] })).toMatchObject({ valid: false });

    const proposal = proposeWorkflowPatch({
      workflow,
      operations: [{ operation: "add-node", node: { id: "output-1", type: "output" } }],
      reason: "Expose the generated image as an output",
    });
    expect(proposal).toMatchObject({ approvalRequired: true, appliesAutomatically: false, baseRevisionId: "rev-1" });
    expect(proposal.preview.after.nodes).toHaveLength(3);
  });
});

function document(documentKey: string, collectionKey: string, audience: "public" | "internal", environment: "gray" | "production", body: string) {
  return { publicationId: `pub-${documentKey}`, documentId: `doc-${documentKey}`, documentKey, collectionKey, audience, environment, version: 1, title: documentKey, body, bodyHash: `hash-${documentKey}` };
}

function publication(documentKey: string) {
  return document(documentKey, "public-canvas", "public", "gray", documentKey);
}

function template(templateKey: string) {
  return { templateKey, revision: 1, hash: `hash-${templateKey}`, documentId: `doc-${templateKey}` };
}
