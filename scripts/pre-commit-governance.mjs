import { spawnSync } from "node:child_process";

const rootDir = fileUrlPath(new URL("../", import.meta.url));
const steps = [
  {
    label: "verify-no-runtime-artifacts-staged",
    args: ["scripts/verify-no-runtime-artifacts-staged.mjs"],
  },
  {
    label: "verify-staged-source-size-guard",
    args: ["scripts/verify-staged-source-size-guard.mjs"],
  },
  {
    label: "verify-file-hotspot-budgets",
    args: ["scripts/verify-file-hotspot-budgets.mjs"],
  },
  {
    label: "verify-hotspot-watchlist-contract",
    args: ["scripts/verify-hotspot-watchlist-contract.mjs"],
  },
  {
    label: "verify-hotspot-doc-sync-staged",
    args: ["scripts/verify-hotspot-doc-sync-staged.mjs"],
  },
  {
    label: "verify-release-logbook-sync-staged",
    args: ["scripts/verify-release-logbook-sync-staged.mjs"],
  },
  {
    label: "verify-current-release-entry-consistency",
    args: ["scripts/verify-current-release-entry-consistency.mjs"],
  },
  {
    label: "verify-release-governance-contract",
    args: ["scripts/verify-release-governance-contract.mjs"],
  },
  {
    label: "verify-documentation-entry-contract",
    args: ["scripts/verify-documentation-entry-contract.mjs"],
  },
  {
    label: "verify-visual-design-docs-contract",
    args: ["scripts/verify-visual-design-docs-contract.mjs"],
  },
  {
    label: "verify-system-doc-template-contract",
    args: ["scripts/verify-system-doc-template-contract.mjs"],
  },
];

for (const step of steps) {
  console.log(`[pre-commit-governance] running ${step.label}`);
  const result = spawnSync(process.execPath, step.args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  if (result.stdout?.trim()) process.stdout.write(result.stdout);
  if (result.stderr?.trim()) process.stderr.write(result.stderr);
  if (result.status === 0) continue;
  process.exit(result.status ?? 1);
}

console.log("[pre-commit-governance] all governance checks passed");

function fileUrlPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\//g, "\\"));
}
