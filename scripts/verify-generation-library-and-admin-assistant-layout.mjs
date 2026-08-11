import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function blockFor(source, selector) {
  const pattern = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\n\\}`, "gm");
  const matches = [...source.matchAll(pattern)].map((match) => match[1]);
  assert.ok(matches.length > 0, `missing CSS block for ${selector}`);
  return matches.at(-1);
}

async function run() {
  const apiServer = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  const artifactRoutes = await readFile(new URL("../apps/api/src/generation-artifact-routes.ts", import.meta.url), "utf8");
  const artifactRepository = await readFile(new URL("../apps/api/src/generation-artifact-repository.ts", import.meta.url), "utf8");
  const artifactLifecycle = await readFile(new URL("../apps/api/src/generation-artifact-lifecycle.ts", import.meta.url), "utf8");
  const artifactStore = await readFile(new URL("../apps/api/src/artifact-store.ts", import.meta.url), "utf8");
  const artifactShared = await readFile(new URL("../packages/shared/src/generation-artifact.ts", import.meta.url), "utf8");
  const workerOutput = await readFile(new URL("../apps/worker/src/output-materials.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
  const webApi = await readFile(new URL("../apps/web/src/services/api.ts", import.meta.url), "utf8");
  const webApiTypes = await readFile(new URL("../apps/web/src/services/generation-library-api-types.ts", import.meta.url), "utf8");
  const drawer = await readFile(new URL("../apps/web/src/components/GenerationLibraryDrawer.tsx", import.meta.url), "utf8");
  const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
  const adminCss = await readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8");

  assert.match(artifactShared, /generationArtifactTtlMsForDays/, "generation library TTL should derive from configured retention days");
  assert.match(workerOutput, /outputRetentionDays/, "worker materialization should consume configured retention days");
  assert.match(apiServer, /readOutputRetentionDays/, "API runtime should expose the authoritative retention setting");
  assert.match(artifactRoutes, /\/api\/generation-library\/settings/, "generation library settings route should exist");
  assert.match(apiServer, /generationLibraryDbPath:\s*join\(resourceDir,\s*"generation-library\.json"\)/, "generation library should use a separate short-lived ledger");
  assert.match(artifactRoutes, /url\.pathname === "\/api\/generation-library\/items"/, "generation library list/add API should exist");
  assert.match(artifactRepository, /expiresAt:\s*Math\.max\(previous\?\.expiresAt \|\| 0, expiresAt\)/, "duplicate registration should preserve the later configured expiry");
  assert.match(artifactLifecycle, /artifactStore\.deleteOwned\(ownerId, filename\)/, "deleted local output files should be pruned through the owned artifact store");
  assert.match(artifactStore, /!filename \|\| \/\[\\\\\/\]\/.test\(filename\) \|\| filename\.includes\("\.\."\)/, "generation library cleanup must reject non-local storage keys");
  assert.match(artifactRoutes, /materialAccessService\.buildGenerationLibraryAccessDescriptor/, "generation library responses should expose access metadata via descriptor service");
  assert.match(artifactRoutes, /contentMatch = url\.pathname\.match/, "generation library content route should exist");
  assert.match(artifactRoutes, /\\\/api\\\/materials\\\/generation-library\\\//, "generation library content route should target generation-library material access");

  assert.match(webApiTypes, /export type GenerationLibraryKind = 'image' \| 'video' \| 'audio';/, "web API should expose image/video/audio generation kinds");
  assert.match(webApi, /getGenerationLibraryItems/, "web API should expose generation library listing");
  assert.match(webApi, /addGenerationLibraryItem/, "web API should expose generation library add");
  assert.match(webApi, /deleteGenerationLibraryItem/, "web API should expose generation library delete");

  assert.match(app, /const GenerationLibraryDrawer = lazy/, "generation library drawer should be lazy loaded beside resource library");
  assert.match(app, /setGenerationLibraryOpen\(true\)/, "topbar should open the generation library");
  assert.match(app, />生成库</, "topbar should show a generation library button");
  assert.match(app, /<GenerationLibraryDrawer[\s\S]*?onInsertMaterial=\{handleInsertGeneration\}/, "generation library drawer should insert material into canvas");

  assert.match(drawer, /retentionDays/, "drawer should render the server-authoritative retention window");
  assert.doesNotMatch(drawer, /最多保留 3 天/, "drawer must not hardcode a three-day retention window");
  assert.match(webApi, /getGenerationLibrarySettings/, "web API should expose generation-library runtime settings");
  assert.match(drawer, /data-drag-node-id="generation-library"/, "generated assets should support material drag from the drawer");
  assert.match(drawer, /formatRemaining\(item\.expiresAt\)/, "drawer should show remaining retention time");
  assert.match(drawer, /api\.deleteGenerationLibraryItem/, "drawer should support explicit deletion");
  assert.match(drawer, /下载/, "generation library drawer should expose download action");
  assert.match(drawer, /查看/, "generation library drawer should expose preview action");
  assert.match(drawer, /GenerationLibraryPreviewOverlay/, "generation library drawer should wire the preview overlay");

  assert.match(adminMain, /activeTab === "agent-runtime"/, "assistant governance should live in the agent runtime workspace");
  assert.match(adminMain, /AdminAssistantGovernanceWorkspace/, "assistant governance workspace should remain routed");
  assert.match(adminCss, /\.assistant-settings-page\s*\{/, "assistant settings styles should remain available");

  console.log("PASS generation library and admin assistant layout contracts are present");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
