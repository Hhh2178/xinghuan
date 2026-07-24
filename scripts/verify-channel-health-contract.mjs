import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = {
  packageJson: JSON.parse(await read("package.json")),
  migration: await read("apps/api/db/042_provider_model_channel_health.sql"),
  repository: await read("apps/api/src/channel-health-repository.ts"),
  routes: await read("apps/api/src/channel-health-routes.ts"),
  server: await read("apps/api/src/server.ts"),
  shared: await read("packages/shared/src/channel-health.ts"),
  report: await read("packages/ui/src/channel-health-report.tsx"),
  toolbar: await read("apps/web/src/components/CanvasToolbar.tsx"),
  webApp: await read("apps/web/src/App.tsx"),
  webRefresh: await read("apps/web/src/components/channel-health/channel-health-refresh.ts"),
  webHook: await read("apps/web/src/components/channel-health/useChannelHealth.ts"),
  adminViewModel: await read("apps/admin/src/admin-view-model.ts"),
  adminDashboard: await read("apps/admin/src/admin-channel-health-dashboard.tsx"),
  adminRefresh: await read("apps/admin/src/admin-channel-health-refresh.ts"),
};

assert.match(files.migration, /create table if not exists xh_channel_feedback/i, "migration must create feedback storage");
assert.match(files.migration, /unique\s*\(owner_id, provider_id, model_id\)/i, "feedback must remain one vote per owner/channel");
assert.match(files.migration, /check\s*\(vote in \('up', 'down'\)\)/i, "feedback vote must remain constrained");
assert.match(files.migration, /where status in \('succeeded', 'failed'\)/i, "settled-task indexes must exclude unfinished tasks");

assert.match(files.repository, /t\.status in \('succeeded', 'failed'\)/, "repository must aggregate settled tasks only");
assert.match(files.repository, /ci\.cost_item_type = 'provider_cost'/, "repository must use immutable provider-cost ownership");
assert.match(files.repository, /on conflict \(owner_id, provider_id, model_id\)/, "repository must upsert votes atomically");
assert.doesNotMatch(files.repository, /owner_email/i, "repository must not retrieve voter identity");
assert.doesNotMatch(files.server, /function\s+(read|write|upsert).*ChannelHealth/i, "server must delegate channel health SQL ownership");

for (const route of ["/api/channel-health", "/api/channel-health/feedback", "/api/admin/analytics/model-success-rates"]) {
  assert.ok(files.routes.includes(route), `channel health route missing ${route}`);
}

assert.match(files.shared, /bucketCount: 36/, "shared report must preserve 36 buckets");
assert.match(files.shared, /const BUCKET_COUNT = 36/, "bucket helper must preserve the 36-bucket window");
assert.match(files.shared, /interface ChannelFeedbackSummary/, "shared report must expose aggregate feedback");
assert.doesNotMatch(files.shared, /ownerId|owner_id|voter/i, "shared report must not expose voter identity");
assert.match(files.report, /<svg/, "shared report must render a trend SVG");
assert.match(files.report, /data-empty=/, "shared report must render explicit empty buckets");

assert.match(files.toolbar, /penguin:open-channel-health/, "Canvas toolbar must expose channel health entry");
assert.match(files.webApp, /ChannelHealthModal/, "Web App must own the lazy channel health modal");
assert.match(files.webRefresh, /manualRefreshCoolingDown/, "Web must preserve manual refresh cooldown");
assert.match(files.webHook, /msUntilNextWholeHour/, "Web must schedule whole-hour refreshes");
assert.match(files.webHook, /10_000/, "Web manual refresh cooldown must remain ten seconds");

assert.match(files.adminViewModel, /"reliability"/, "Admin view model must expose reliability analytics");
assert.match(files.adminViewModel, /\/admin\/analytics\/reliability/, "Admin reliability route must remain stable");
assert.match(files.adminDashboard, /RefreshCw/, "Admin dashboard must expose manual refresh");
assert.match(files.adminDashboard, /5 \* 60_000/, "Admin auto-refresh must remain five minutes");
assert.match(files.adminDashboard, /checked=\{autoRefresh\}/, "Admin auto-refresh must default to opt-in state");
assert.match(files.adminRefresh, /visibilityState === "visible"/, "Admin auto-refresh must pause in hidden tabs");

const scripts = files.packageJson.scripts || {};
assert.equal(scripts["verify:channel-health-contract"], "node scripts/verify-channel-health-contract.mjs", "package script must expose channel health contract");
assert.match(scripts["harness:verify:project"] || "", /verify:channel-health-contract/, "project harness must run channel health contract");

console.log(JSON.stringify({ ok: true, contract: "channel-health" }, null, 2));

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}
