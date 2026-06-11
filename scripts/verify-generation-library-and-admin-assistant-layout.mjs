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
  const app = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
  const canvas = await readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8");
  const webApi = await readFile(new URL("../apps/web/src/services/api.ts", import.meta.url), "utf8");
  const drawer = await readFile(new URL("../apps/web/src/components/GenerationLibraryDrawer.tsx", import.meta.url), "utf8");
  const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
  const adminCss = await readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8");

  assert.match(apiServer, /const GENERATION_LIBRARY_TTL_MS = 3 \* 24 \* 60 \* 60 \* 1000;/, "generation library TTL must be exactly 3 days");
  assert.match(apiServer, /generationLibraryDbPath:\s*join\(resourceDir,\s*"generation-library\.json"\)/, "generation library should use a separate short-lived ledger");
  assert.match(apiServer, /url\.pathname === "\/api\/generation-library\/items"/, "generation library list/add API should exist");
  assert.match(apiServer, /expiresAt:\s*existing \? existing\.expiresAt : expiresAt/, "duplicate generated assets must not extend the 3-day retention cap");
  assert.match(apiServer, /deleteGenerationLibraryLocalFile/, "expired or deleted local output files should be pruned by explicit item path");
  assert.match(apiServer, /url\.startsWith\("\/files\/output\/"\)/, "generation library cleanup must only delete explicit local output files");

  assert.match(webApi, /export type GenerationLibraryKind = 'image' \| 'video' \| 'audio';/, "web API should expose image/video/audio generation kinds");
  assert.match(webApi, /getGenerationLibraryItems/, "web API should expose generation library listing");
  assert.match(webApi, /addGenerationLibraryItem/, "web API should expose generation library add");
  assert.match(webApi, /deleteGenerationLibraryItem/, "web API should expose generation library delete");

  assert.match(app, /const GenerationLibraryDrawer = lazy/, "generation library drawer should be lazy loaded beside resource library");
  assert.match(app, /setGenerationLibraryOpen\(true\)/, "topbar should open the generation library");
  assert.match(app, />生成库</, "topbar should show a generation library button");
  assert.match(app, /<GenerationLibraryDrawer[\s\S]*?onInsertMaterial=\{handleInsertGeneration\}/, "generation library drawer should insert material into canvas");

  assert.match(drawer, /最多保留 3 天/, "drawer should clearly show the 3-day retention rule");
  assert.match(drawer, /data-drag-node-id="generation-library"/, "generated assets should support material drag from the drawer");
  assert.match(drawer, /formatRemaining\(item\.expiresAt\)/, "drawer should show remaining retention time");
  assert.match(drawer, /api\.deleteGenerationLibraryItem/, "drawer should support explicit deletion");

  assert.match(canvas, /GENERATION_LIBRARY_NODE_TYPES/, "canvas should define generated-output node sources");
  assert.match(canvas, /api\.addGenerationLibraryItem/, "canvas should auto-register generated media");
  assert.match(canvas, /item\.url\.startsWith\('\/files\/output\/'\)/, "canvas should only auto-register generated output files");
  assert.match(canvas, /penguin:generation-library-changed/, "canvas should notify drawer after registering generated assets");

  assert.match(adminMain, /activeTab === "providers" \|\| activeTab === "assistant"/, "assistant settings page should use fixed panel layout");
  const viewport = blockFor(adminCss, "html,\nbody,\n#root");
  const body = blockFor(adminCss, "body");
  const workspace = blockFor(adminCss, ".admin-workspace");
  const fixedPanel = blockFor(adminCss, ".admin-main--fixed-panel");
  const fixedPanelChild = blockFor(adminCss, ".admin-main--fixed-panel > *");
  const settingsPage = blockFor(adminCss, ".assistant-settings-page");
  const sectionHead = blockFor(adminCss, ".admin-assistant-dock__section-head");

  assert.match(viewport, /height:\s*100%;/, "admin viewport roots should be locked to the browser height");
  assert.match(viewport, /overflow:\s*hidden;/, "admin viewport roots should not own a page scrollbar");
  assert.doesNotMatch(body, /overflow-y:\s*auto;/, "admin body should not own the page scroll");
  assert.match(workspace, /overflow:\s*hidden;/, "admin workspace should prevent a second viewport scrollbar");
  assert.match(fixedPanel, /grid-template-rows:\s*auto minmax\(0,\s*1fr\);/, "fixed admin panels should reserve one bounded content slot");
  assert.match(fixedPanelChild, /min-height:\s*0;/, "fixed admin panel children should be allowed to shrink instead of forcing page scroll");
  assert.match(settingsPage, /height:\s*100%;/, "assistant settings page should fill the fixed content slot");
  assert.match(settingsPage, /overflow:\s*auto;/, "assistant settings page should own internal scrolling");
  assert.match(settingsPage, /overscroll-behavior:\s*contain;/, "assistant settings scrolling should not chain into a page-level scrollbar");
  assert.match(adminCss, /\.admin-main--assistant-settings\s*\{[\s\S]*?overflow-y:\s*auto;/, "assistant settings should use the main admin scroll instead of a nested page scrollbar");
  assert.match(adminCss, /\.admin-main--assistant-settings \.assistant-settings-page\s*\{[\s\S]*?overflow:\s*visible;/, "assistant settings page should not create a second scrollbar in assistant settings view");
  assert.doesNotMatch(settingsPage, /max-height:\s*calc\(100vh - 120px\);/, "assistant settings page should not create a competing viewport scroll height");
  assert.match(sectionHead, /min-height:\s*42px;/, "assistant context summary should be a clear click target");
  assert.match(sectionHead, /cursor:\s*pointer;/, "assistant context summary should feel interactive");
  assert.match(adminCss, /\.admin-assistant-dock__section-head::after[\s\S]*?content:\s*"展开";/, "collapsed context should expose an explicit open label");
  assert.match(adminCss, /\.admin-assistant-dock__context\[open\] \.admin-assistant-dock__section-head::after[\s\S]*?content:\s*"收起";/, "expanded context should expose an explicit close label");

  console.log("PASS generation library and admin assistant layout contracts are present");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
