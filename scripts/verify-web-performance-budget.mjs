import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const appSource = readFileSync(join(root, "apps/web/src/App.tsx"), "utf8");
const assetsDir = join(root, "apps/web/dist/assets");

const checks = [
  {
    name: "workspace shell is lazy-loaded after authentication",
    pass:
      appSource.includes("lazy(() => import('./components/Canvas'))") &&
      appSource.includes("lazy(() => import('./components/Sidebar'))") &&
      appSource.includes("lazy(() => import('./components/ResourceLibraryDrawer'))") &&
      appSource.includes("import('./providers/RHToolsProvider')") &&
      !appSource.includes("import Canvas, { type AddNodeFn, type InsertWorkflowFn } from './components/Canvas'") &&
      !appSource.includes("import Sidebar from './components/Sidebar'"),
  },
  {
    name: "authenticated workspace has a Suspense loading state",
    pass: appSource.includes("<Suspense fallback={<WorkspaceShellFallback />}>") && appSource.includes("function WorkspaceShellFallback"),
  },
];

if (existsSync(assetsDir)) {
  const jsAssets = readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, size: statSync(join(assetsDir, name)).size }));
  const entry = jsAssets.find((asset) => /^index-[\w-]+\.js$/.test(asset.name));
  checks.push({
    name: "web entry chunk stays below 900 kB",
    pass: Boolean(entry && entry.size < 900_000),
    detail: entry ? `${entry.name}=${entry.size}` : "missing index chunk",
  });
} else {
  checks.push({
    name: "web dist assets exist for bundle budget check",
    pass: false,
    detail: "run npm run build -w @xinghuan/web first",
  });
}

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  const detail = check.detail ? ` (${check.detail})` : "";
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${detail}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} web performance budget checks failed.`);
  process.exit(1);
}

console.log("\nAll web performance budget checks passed.");
