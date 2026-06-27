import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const viewModel = readFileSync(join(root, "apps", "admin", "src", "admin-view-model.ts"), "utf8");
const main = readFileSync(join(root, "apps", "admin", "src", "main.tsx"), "utf8");
const apiClient = readFileSync(join(root, "apps", "admin", "src", "admin-api-client.ts"), "utf8");
const panel = readFileSync(join(root, "apps", "admin", "src", "admin-public-resources-panel.tsx"), "utf8");
const sidebar = readFileSync(join(root, "apps", "admin", "src", "admin-public-resource-category-sidebar.tsx"), "utf8");
const card = readFileSync(join(root, "apps", "admin", "src", "admin-public-resource-card.tsx"), "utf8");
const styles = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

assert.doesNotMatch(viewModel, /"generation-library"/, "resource-content workspace should remove generation-library tab");
assert.doesNotMatch(viewModel, /label: "生成库"/, "admin nav should not expose generation-library label");
assert.match(viewModel, /tabs:\s*\["public-resources",\s*"announcement"\]/, "resource-content workspace should keep public resources and announcement");
assert.match(viewModel, /公共资源、公告、分类与标签/, "resource-content workspace description should no longer mention generation library");

assert.match(apiClient, /\/api\/generation-library\/items/, "generation library backend API may remain available for non-admin surfaces");

assert.doesNotMatch(main, /AdminGenerationLibraryPanel/, "main shell should not import generation library panel");
assert.doesNotMatch(main, /activeTab === "generation-library"/, "main shell should not route generation library tab");
assert.match(main, /<AdminPublicResourcesPanel/, "main shell should still render public resources panel");

assert.match(panel, /公共资源管理/, "public resources panel should preserve governance title");
assert.match(panel, /AdminWorkspaceBand/, "public resources panel should use unified workspace band component");
assert.match(panel, /上传本地资源/, "public resources panel should preserve local upload action");
assert.match(panel, /AdminMediaPreviewModal/, "public resources panel should keep complete preview modal");

assert.match(sidebar, /admin-public-resources-category-card/, "sidebar should still render category cards");
assert.match(card, /完整预览|查看原图|试听|查看资源/, "resource cards should preserve preview actions");
assert.match(card, /object-fit: contain|<img|<video|<audio/, "resource cards should render media preview content");

assert.match(styles, /\.admin-public-resources-grid[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, "resource-content cards should keep four-column desktop grid");
assert.match(styles, /\.admin-public-resources-category-card/, "styles should define resource category cards");
assert.match(styles, /\.admin-workspace-band/, "styles should define unified workspace band");
assert.match(styles, /\.admin-public-resources-category-card__name[\s\S]*#ffffff/i, "category card text should stay white for contrast");

console.log("PASS admin resource content phase2 contract");
