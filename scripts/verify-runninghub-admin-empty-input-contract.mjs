import { readFile } from "node:fs/promises";

const adminTypes = await readFile(new URL("../apps/admin/src/admin-types.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../apps/admin/src/admin-runninghub-workspace.tsx", import.meta.url), "utf8");
const editor = await readFile(new URL("../apps/admin/src/admin-runninghub-item-editor.tsx", import.meta.url), "utf8");

const checks = [
  [
    "Admin RunningHub types preserve allowsEmptyInputs metadata",
    /allowsEmptyInputs\?:\s*boolean/.test(adminTypes),
  ],
  [
    "Admin workspace recognizes explicit empty-input workflows",
    /item\.allowsEmptyInputs === true/.test(workspace),
  ],
  [
    "Admin workspace no longer labels explicit empty-input workflows as missing slots",
    /无入参工作流/.test(workspace),
  ],
  [
    "Admin editor recognizes explicit empty-input workflows",
    /currentItem\.allowsEmptyInputs === true/.test(editor),
  ],
  [
    "Admin editor save guard allows enabled empty-input workflows without slot bindings",
    /enabled && validFieldCount <= 0 && !allowsEmptyInputs/.test(editor),
  ],
  [
    "Admin editor summary reports explicit empty-input workflows as ready",
    /无入参可直接启用/.test(editor),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
