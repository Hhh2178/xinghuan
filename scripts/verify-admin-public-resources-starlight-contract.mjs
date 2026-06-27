import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const panel = readFileSync(join(root, "apps", "admin", "src", "admin-public-resources-panel.tsx"), "utf8");
const card = readFileSync(join(root, "apps", "admin", "src", "admin-public-resource-card.tsx"), "utf8");
const sidebar = readFileSync(join(root, "apps", "admin", "src", "admin-public-resource-category-sidebar.tsx"), "utf8");
const modal = readFileSync(join(root, "apps", "admin", "src", "admin-media-preview-modal.tsx"), "utf8");
const styles = readFileSync(join(root, "apps", "admin", "src", "styles.css"), "utf8");

assert.match(panel, /admin-public-resources-page--starlight/, "public resources page should opt into the Starlight resource workbench skin");
assert.match(panel, /admin-public-resources-inspector/, "public resources page should expose a compact inspector summary area");
assert.match(panel, /上传本地资源/, "public resource uploads should remain local file button based");
assert.match(panel, /type="file"/, "public resource upload should use a hidden file input");

assert.match(sidebar, /admin-public-resources-sidebar--starlight/, "category sidebar should use the readable Starlight category skin");
assert.match(sidebar, /admin-public-resources-category-card__name/, "category names should have a dedicated no-overflow text target");

assert.match(card, /admin-public-resource-card--starlight/, "resource cards should use the Starlight card shell");
assert.match(card, /admin-public-resource-card__preview-stage/, "resource card preview should render inside a stable black contain stage");
assert.match(card, /admin-public-resource-card__action-row/, "resource card actions should be grouped into wrapping rows");
assert.match(card, /getPreviewText/, "resource card should expose a complete preview action");
assert.match(card, /<img/, "resource card should preview images");
assert.match(card, /<video/, "resource card should preview videos");
assert.match(card, /<audio/, "resource card should preview audio");

assert.match(modal, /admin-media-preview-modal--starlight/, "complete preview modal should use the Starlight media skin");
assert.match(modal, /<img/, "complete preview modal should support images");
assert.match(modal, /<video/, "complete preview modal should support videos");
assert.match(modal, /<audio/, "complete preview modal should support audio");

assert.match(styles, /\.admin-public-resources-grid[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, "desktop public resource grid should target four cards per row");
assert.match(styles, /@media\s*\(max-width:\s*1280px\)[\s\S]*\.admin-public-resources-grid[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, "public resource grid should step down cleanly on medium screens");
assert.match(styles, /\.admin-public-resource-card__preview-stage[\s\S]*background:\s*#000/, "card media preview stage should use black letterboxing");
assert.match(styles, /\.admin-public-resource-card__preview-frame[\s\S]*object-fit:\s*contain/, "card media should preserve the full asset ratio");
assert.match(styles, /\.admin-public-resource-card__action-row[\s\S]*flex-wrap:\s*wrap/, "card action rows should wrap instead of overflowing");
assert.match(styles, /\.admin-media-preview-modal__stage[\s\S]*object-fit:\s*contain/, "complete preview modal should contain full media");
assert.match(styles, /\.admin-public-resources-category-card__name[\s\S]*color:\s*#fff/, "category names should render as readable white text");

console.log("PASS admin public resources Starlight contract");
