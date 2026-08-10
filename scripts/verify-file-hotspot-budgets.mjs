import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const budgets = [
  {
    path: "apps/api/src/server.ts",
    maxLines: 11960,
    owner: "API super entry",
    reason: "RunningHub / task / system handlers must keep moving out of server.ts",
  },
  {
    path: "apps/worker/src/worker.ts",
    maxLines: 1765,
    owner: "Worker orchestration entry",
    reason: "Provider clients / dispatch / diagnostics should not keep piling into worker.ts",
  },
  {
    path: "apps/web/src/components/nodes/RunningHubNode.tsx",
    maxLines: 1526,
    owner: "RunningHub canvas node",
    reason: "Runtime logic should continue moving into shared hooks/helpers",
  },
  {
    path: "apps/admin/src/admin-runninghub-workspace.tsx",
    maxLines: 916,
    owner: "RunningHub admin workspace",
    reason: "Workspace sections should continue splitting instead of growing the page shell",
  },
];

const results = [];
for (const budget of budgets) {
  const text = await readFile(new URL(`../${budget.path}`, import.meta.url), "utf8");
  const lineCount = countLines(text);
  assert.ok(
    lineCount <= budget.maxLines,
    `${budget.path} exceeds hotspot budget: ${lineCount} > ${budget.maxLines}. ${budget.reason}`,
  );
  results.push({
    path: budget.path,
    lineCount,
    maxLines: budget.maxLines,
    owner: budget.owner,
  });
}

console.log(JSON.stringify({
  ok: true,
  verifiedAt: new Date().toISOString(),
  budgets: results,
}, null, 2));

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}
