import { readFile } from "node:fs/promises";

const catalog = await readFile(new URL("../apps/web/src/services/runninghubCatalog.ts", import.meta.url), "utf8");
const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");

const checks = [
  [
    "Web catalog preserves allowsEmptyInputs from public RunningHub items",
    /allowsEmptyInputs:\s*row\.allowsEmptyInputs === true/.test(catalog),
  ],
  [
    "RunningHub node suppresses missing-field warning for explicit empty-input presets",
    /selectedPresetAllowsEmptyInputs[\s\S]*selectedPresetHasNoResolvedFields = Boolean\(selectedWorkflowPreset\) && !selectedPresetAllowsEmptyInputs/.test(node),
  ],
  [
    "RunningHub node shows dedicated hint for explicit empty-input presets",
    /无入参工作流。参数区为空属于正常现象，可以直接运行/.test(node),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
