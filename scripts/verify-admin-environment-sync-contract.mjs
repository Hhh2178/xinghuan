import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const types = readFileSync(join(root, "apps/admin/src/admin-types.ts"), "utf8");
const main = readFileSync(join(root, "apps/admin/src/main.tsx"), "utf8");
const viewModel = readFileSync(join(root, "apps/admin/src/admin-view-model.ts"), "utf8");
const server = readFileSync(join(root, "apps/api/src/server.ts"), "utf8");
const panel = readFileSync(join(root, "apps/admin/src/admin-environment-sync-panel.tsx"), "utf8");
const shared = readFileSync(join(root, "packages/shared/src/environment-sync.ts"), "utf8");

assert(types.includes("EnvironmentSyncTarget"));
assert(types.includes("EnvironmentSyncPreviewResponse"));
assert(types.includes("EnvironmentSyncProviderModelSummary"));
assert(viewModel.includes("environment-sync"));
assert(main.includes("AdminEnvironmentSyncPanel"));
assert(server.includes('/api/admin/environment-sync/preview'));
assert(server.includes('/api/admin/environment-sync/apply'));
assert(shared.includes("providerModelSummary"));
assert(panel.includes("从哪里复制"));
assert(panel.includes("同步到哪里"));
assert(panel.includes("先查看差异"));
assert(panel.includes("确认同步"));
assert(panel.includes("服务商（含模型）"));
assert(panel.includes("以左侧环境为准"));
assert(panel.includes("保留右侧当前数据"));

console.log(JSON.stringify({ ok: true }, null, 2));
