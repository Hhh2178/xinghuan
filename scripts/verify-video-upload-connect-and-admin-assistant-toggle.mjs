import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function run() {
  const portTypes = await readFile(new URL("../apps/web/src/config/portTypes.ts", import.meta.url), "utf8");
  const canvas = await readFile(new URL("../apps/web/src/components/Canvas.tsx", import.meta.url), "utf8");
  const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
  const adminApiPanel = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf8");
  const adminAssistantPanel = await readFile(new URL("../apps/admin/src/admin-assistant-panel.tsx", import.meta.url), "utf8");
  const adminCss = await readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8");

  assert.match(portTypes, /function hasMediaOutput\(/, "upload output should infer media kind from existing media fields");
  assert.match(portTypes, /hasMediaOutput\(data,\s*'image'\)/, "upload should infer image outputs from imageUrl/imageUrls");
  assert.match(portTypes, /hasMediaOutput\(data,\s*'video'\)/, "upload should infer video outputs from videoUrl/videoUrls");
  assert.match(portTypes, /hasMediaOutput\(data,\s*'audio'\)/, "upload should infer audio outputs from audioUrl/audioUrls");
  assert.match(portTypes, /video:\s*\{\s*inputs:\s*\['text',\s*'image',\s*'video',\s*'audio'\]/, "video node should accept text and uploaded media inputs");

  assert.match(canvas, /const onConnect = useCallback\(/, "canvas should still own connection creation");
  assert.match(canvas, /isConnectionValid\(src,\s*tgt\)/, "connection creation should validate source and target before adding edges");

  assert.match(adminMain, /admin-assistant-topbar-toggle/, "admin topbar should expose a persistent AI assistant toggle");
  assert.match(adminMain, /setAssistantOpen\(\(current\) => !current\)/, "admin topbar toggle should reopen a closed assistant panel");
  assert.match(adminMain, /aria-pressed=\{assistantOpen\}/, "admin assistant toggle should expose pressed state");
  assert.match(adminCss, /\.admin-assistant-topbar-toggle\.icon-button[\s\S]*?min-width:\s*108px;/, "admin assistant topbar toggle must not collapse to the generic icon button size");
  assert.match(adminCss, /\.admin-assistant-topbar-toggle span[\s\S]*?min-width:\s*max-content;/, "admin assistant topbar label should stay readable");
  assert.match(adminCss, /\.topbar-actions[\s\S]*?flex-wrap:\s*wrap;/, "admin topbar actions should wrap instead of visually mixing");
  assert.match(adminCss, /\.assistant-governance-workspace[\s\S]*?display:\s*grid;/, "assistant governance should use the desktop operational grid");
  assert.doesNotMatch(adminCss, /\.assistant-governance-workspace[\s\S]*?max-height:\s*calc\(100vh - 120px\);/, "assistant governance should not create a competing viewport-height scrollbar");
  assert.doesNotMatch(adminCss, /\.admin-assistant-dock__toggle\s*\{/, "assistant dock should not expose a second floating toggle that overlaps the header");
  assert.match(adminAssistantPanel, /<details className="admin-assistant-dock__context">/, "assistant context picker should be collapsible");
  assert.match(adminAssistantPanel, /页面 <strong>\{activeTab\}<\/strong>/, "assistant dock should use compact page status chips");
  assert.doesNotMatch(adminAssistantPanel, /<div className="admin-assistant-dock__status-card">\s*<span>当前页面<\/span>/, "assistant dock should not render tall status cards");
  assert.match(adminCss, /\.admin-assistant-dock__status-card[\s\S]*?display:\s*inline-flex;/, "assistant status indicators should render as compact chips");
  assert.match(adminCss, /\.admin-assistant-dock__quick-actions button[\s\S]*?min-height:\s*48px;/, "assistant context actions should be compact");

  assert.match(adminApiPanel, /assistant-draft-section--summary/, "API assistant result should render a structured summary section");
  assert.match(adminApiPanel, /Provider 草案/, "API assistant result should show provider draft section");
  assert.match(adminApiPanel, /模型草案/, "API assistant result should show model draft section");
  assert.match(adminApiPanel, /异步任务配置/, "API assistant result should show async task configuration section");
  assert.match(adminApiPanel, /formatAssistantRawOutput\(/, "API assistant raw output should be normalized before rendering");
  assert.match(adminApiPanel, /assistant-draft-raw/, "API assistant raw output should be collapsed behind details");
  assert.match(adminCss, /\.assistant-draft-raw pre[\s\S]*?max-height:\s*220px;/, "API assistant raw output should be height-limited");

  console.log("PASS video upload connection fallback and admin assistant reopen toggle are present");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
