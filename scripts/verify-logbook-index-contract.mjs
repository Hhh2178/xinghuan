import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const monthDir = resolve(root, "docs/logbooks/daily/2026/2026-07");
for (const name of ["README.md", "recent-highlights.md", "2026-07-16.md"]) {
  await access(resolve(monthDir, name));
}
const highlights = await readFile(resolve(monthDir, "recent-highlights.md"), "utf8");
if (!highlights.includes("package.json") || !highlights.includes("release-state.json")) {
  throw new Error("recent-highlights must point to canonical state files");
}
const logbooks = await readFile(resolve(root, "docs/logbooks/README.md"), "utf8");
if (!logbooks.includes("2026-07/recent-highlights.md") || !logbooks.includes("verify:logbook-index-contract")) {
  throw new Error("docs/logbooks/README.md is missing current index contract");
}
console.log(JSON.stringify({ ok: true, month: "2026-07", requiredFiles: 3 }, null, 2));
