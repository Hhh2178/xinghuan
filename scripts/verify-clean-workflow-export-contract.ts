import assert from "node:assert/strict";

import {
  createWorkflowResourceManifest,
  workflowManifestToFragment,
} from "../apps/web/src/utils/workflowResource.ts";

function readNodeData(manifest: ReturnType<typeof createWorkflowResourceManifest>) {
  return (manifest.nodes[0] as any)?.data || {};
}

const manifest = createWorkflowResourceManifest({
  sourceCanvasId: "canvas-clean-export",
  nodes: [
    {
      id: "llm-1",
      type: "llm",
      position: { x: 120, y: 80 },
      data: {
        prompt: "keep prompt",
        modelId: "agnes-2.0",
        history: [{ role: "user", content: "old history" }],
        reply: "stale reply",
        generatedImages: [{ url: "/files/output/old.png" }],
        imageUrls: ["/files/output/old.png"],
        taskRuns: [{ id: "task-old-1" }],
        taskId: "task-old-1",
        progress: 45,
        errorMessage: "old error",
        resourceSource: "shared",
        resourceItemId: "shared-image-1",
        resourceKind: "image",
        fallbackUrl: "/files/output/fallback.png",
      },
    } as any,
  ],
  edges: [],
});

const data = readNodeData(manifest);

assert.equal(data.userPrompt, "keep prompt", "user-authored prompt should survive as userPrompt");
assert.equal(data.modelId, "agnes-2.0", "configured model should be preserved");
assert.equal(data.resourceSource, "shared", "shared resource source should be preserved");
assert.equal(data.resourceItemId, "shared-image-1", "shared resource id should be preserved");
assert.equal(data.resourceKind, "image", "shared resource kind should be preserved");
assert.equal(data.fallbackUrl, "/files/output/fallback.png", "fallback url should be preserved");

for (const key of [
  "history",
  "reply",
  "generatedImages",
  "imageUrls",
  "taskRuns",
  "taskId",
  "progress",
  "errorMessage",
  "prompt",
] as const) {
  assert.equal(key in data, false, `${key} should be stripped from clean workflow export`);
}

const fragment = workflowManifestToFragment(manifest);
assert.ok(fragment, "manifest should remain restorable after cleanup");
assert.equal((fragment?.nodes?.[0] as any)?.data?.resourceItemId, "shared-image-1");

console.log("PASS clean workflow export contract");
