import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const overlayPath = join(root, "apps", "web", "src", "components", "GenerationLibraryPreviewOverlay.tsx");
const overlaySource = existsSync(overlayPath) ? readFileSync(overlayPath, "utf8") : "";
assert.equal(existsSync(overlayPath), true, "GenerationLibraryPreviewOverlay should exist");
assert.match(overlaySource, /export default function GenerationLibraryPreviewOverlay/, "overlay component should be exported");
assert.match(overlaySource, /role="dialog"/, "overlay should expose dialog semantics");
assert.match(overlaySource, /下载/, "overlay should expose a download action");
assert.match(overlaySource, /上一张|上一项/, "overlay should expose previous navigation");
assert.match(overlaySource, /下一张|下一项/, "overlay should expose next navigation");
assert.match(overlaySource, /item\.kind === 'image'/, "overlay should handle image preview");
assert.match(overlaySource, /item\.kind === 'video'/, "overlay should handle video preview");

const drawerPath = join(root, "apps", "web", "src", "components", "GenerationLibraryDrawer.tsx");
const drawerSource = readFileSync(drawerPath, "utf8");
assert.match(drawerSource, /from '\.\/GenerationLibraryPreviewOverlay'/, "drawer should import the preview overlay");
assert.match(drawerSource, /const \[previewIndex, setPreviewIndex\]/, "drawer should track preview state");
assert.match(drawerSource, /查看/, "drawer should render a preview action");
assert.match(drawerSource, /下载/, "drawer should render a download action");
assert.match(drawerSource, /item\.previewUrl \|\| item\.fileUrl/, "drawer should prefer previewUrl");
assert.match(drawerSource, /item\.downloadUrl/, "drawer should use downloadUrl");
assert.match(drawerSource, /<GenerationLibraryPreviewOverlay/, "drawer should mount the overlay");

console.log("PASS generation library preview contract");
