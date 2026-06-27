import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const viewModel = readFileSync(join(root, "apps", "admin", "src", "admin-view-model.ts"), "utf8");
const main = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const apiClient = readFileSync(join(root, "apps", "admin", "src", "admin-api-client.ts"), "utf8");
const types = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");
const panel = readFileSync(join(root, "apps", "admin", "src", "admin-generation-library-panel.tsx"), "utf8");
const card = readFileSync(join(root, "apps", "admin", "src", "admin-generation-library-card.tsx"), "utf8");
const styles = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

assert.match(viewModel, /"generation-library"/, "resource-content workspace should include generation-library tab");
assert.match(viewModel, /label: "生成库"/, "generation-library tab should expose product language label");
assert.match(viewModel, /生成结果卡片治理/, "generation-library tab should describe governance purpose");

assert.match(types, /export type GenerationLibraryKind = "image" \| "video" \| "audio";/, "admin types should define generation library kinds");
assert.match(types, /export interface GenerationLibraryItem/, "admin types should define generation library item shape");

assert.match(apiClient, /export const adminGenerationLibraryApi = \{/, "admin api client should expose generation library API");
assert.match(apiClient, /\/api\/generation-library\/items/, "generation library API should use generation library endpoints");
assert.match(apiClient, /createSharedResourceItem/, "generation library API should support send-to-shared workflow");

assert.match(main, /<AdminGenerationLibraryPanel/, "main shell should render generation library panel");
assert.match(main, /activeTab === "generation-library"/, "main shell should route generation library tab");

assert.match(panel, /生成库后台治理/, "generation library panel should expose governance title");
assert.match(panel, /转公共资源/, "generation library panel should preserve send-to-shared action");
assert.match(panel, /AdminMediaPreviewModal/, "generation library panel should use complete preview modal");
assert.match(panel, /admin-generation-library-summary-grid/, "generation library panel should expose summary cards");

assert.match(card, /admin-generation-library-card/, "generation library should use dedicated card shell");
assert.match(card, /查看完整/, "generation library card should expose complete preview action");
assert.match(card, /下载原件/, "generation library card should expose download action");
assert.match(card, /object-fit: contain|<img|<video|<audio/, "generation library card should render media preview content");

assert.match(styles, /\.admin-generation-library-summary-grid/, "styles should define generation library summary grid");
assert.match(styles, /\.admin-generation-library-card__detail-grid/, "styles should define generation library detail grid");
assert.match(styles, /\.admin-public-resources-grid[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, "resource-content cards should keep four-column desktop grid");

console.log("PASS admin resource content phase2 contract");
