import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const overlayPath = join(root, "apps", "web", "src", "components", "GenerationLibraryPreviewOverlay.tsx");
const overlaySource = existsSync(overlayPath) ? readFileSync(overlayPath, "utf8") : "";
const sharedOverlayPath = join(root, "apps", "web", "src", "components", "resource-library", "ResourcePreviewOverlay.tsx");
const sharedOverlaySource = existsSync(sharedOverlayPath) ? readFileSync(sharedOverlayPath, "utf8") : "";
const combinedOverlaySource = `${overlaySource}\n${sharedOverlaySource}`;
assert.equal(existsSync(overlayPath), true, "GenerationLibraryPreviewOverlay should exist");
assert.match(overlaySource, /export default function GenerationLibraryPreviewOverlay/, "overlay component should be exported");
assert.match(combinedOverlaySource, /role="dialog"/, "overlay should expose dialog semantics");
assert.match(combinedOverlaySource, /下载/, "overlay should expose a download action");
assert.match(combinedOverlaySource, /上一张|上一项/, "overlay should expose previous navigation");
assert.match(combinedOverlaySource, /下一张|下一项/, "overlay should expose next navigation");
assert.match(overlaySource, /item\.kind === 'image'/, "overlay should handle image preview");
assert.match(overlaySource, /item\.kind === 'video'/, "overlay should handle video preview");

const drawerPath = join(root, "apps", "web", "src", "components", "GenerationLibraryDrawer.tsx");
const drawerSource = readFileSync(drawerPath, "utf8");
assert.match(drawerSource, /from '\.\/GenerationLibraryPreviewOverlay'/, "drawer should import the preview overlay");
assert.match(drawerSource, /const \[previewIndex, setPreviewIndex\]/, "drawer should track preview state");
assert.match(drawerSource, /查看/, "drawer should render a preview action");
assert.match(drawerSource, /下载/, "drawer should render a download action");
assert.match(drawerSource, /item\.previewUrl \|\| item\.fileUrl/, "drawer cards should prefer previewUrl");
assert.match(drawerSource, /item\.downloadUrl/, "drawer should use downloadUrl");
assert.match(drawerSource, /<GenerationLibraryPreviewOverlay/, "drawer should mount the overlay");
assert.doesNotMatch(drawerSource, /object-cover/, "generation library drawer cards should not crop image or video previews");
assert.match(drawerSource, /object-contain/, "generation library drawer cards should show full image or video previews");
assert.match(overlaySource, /item\.fileUrl \|\| item\.previewUrl/, "overlay should prefer original media for complete preview");
assert.doesNotMatch(overlaySource, /item\.previewUrl \|\| item\.fileUrl/, "overlay should not prioritize cropped preview assets");
assert.match(sharedOverlaySource, /h-\[min\(88vh,820px\)\]|max-h-\[88vh\]/, "shared overlay should constrain preview stage height");

console.log("PASS generation library preview contract");
