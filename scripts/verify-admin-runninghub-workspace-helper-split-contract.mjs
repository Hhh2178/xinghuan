import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
  const helper = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace-helpers.tsx", import.meta.url), "utf8");

  assert.match(workspace, /from "\.\/admin-runninghub-workspace-helpers"/, "workspace should import extracted RH workspace helpers");
  assert.match(helper, /export function mergeDraftSectionsToCreatePayload\(/, "helper should own create-payload merge logic");
  assert.match(helper, /export function mergeDraftSectionsToUpdatePayload\(/, "helper should own update-payload merge logic");
  assert.match(helper, /export function renderAnalyzeSectionPreview\(/, "helper should own analyze preview rendering");
  assert.match(helper, /export function summarizeAnalyzeDraftDrift\(/, "helper should own analyze drift summary");
  assert.match(helper, /export function normalizeDefaultRunningHubKeyPoolDraft\(/, "helper should own key-pool default normalization");
  assert.match(helper, /export function createEmptyRunningHubKeyPoolDraftItem\(/, "helper should own key-pool draft item creation");
  assert.doesNotMatch(
    workspace,
    /function mergeDraftSectionsToCreatePayload\(|function mergeDraftSectionsToUpdatePayload\(|function renderAnalyzeSectionPreview\(|function summarizeAnalyzeDraftDrift\(/,
    "workspace should stop defining extracted RH helper functions inline",
  );

  console.log("PASS admin RunningHub workspace helper split contract");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
