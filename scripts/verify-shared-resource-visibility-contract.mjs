import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/api/src/group-permission-policy.ts", import.meta.url), "utf8");

assert.match(source, /sharedResourceCategoryIds:\s*\["\*"\]/, "missing group policy should deny all shared categories");
assert.match(source, /sharedResourceItemIds:\s*\["\*"\]/, "missing group policy should deny all shared items");
assert.match(source, /runningHubAppCatalogIds:\s*\["\*"\]/, "missing group policy should deny all runninghub apps");
assert.match(source, /runningHubWorkflowCatalogIds:\s*\["\*"\]/, "missing group policy should deny all runninghub workflows");
assert.match(source, /nodeTypes:\s*\["\*"\]/, "missing group policy should deny all node capabilities");
assert.match(source, /filterSharedResourceItemsForUser[\s\S]*includes\("\*"\)[\s\S]*return \[\]/, "shared resources should hide everything when policy is missing");
assert.match(source, /filterRunningHubCatalogForUser[\s\S]*includes\("\*"\)[\s\S]*return \[\]/, "runninghub catalog should hide everything when policy is missing");
assert.match(source, /canUseNodeType[\s\S]*includes\("\*"\)[\s\S]*return false/, "node capability should hide when policy is missing");

console.log("PASS shared resource visibility contract");
