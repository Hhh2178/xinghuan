import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf-8");

const checks = [
  ["Worker recognizes grsai_draw protocol", worker.includes('"grsai_draw"')],
  ["Worker branches to GRSAI image adapter", worker.includes("executeGrsaiImageTask")],
  ["Worker labels GRSAI results", worker.includes('adapter: "grsai-image"')],
  ["Worker sends GRSAI draw submission", worker.includes("/v1/draw/completions")],
  ["Worker polls GRSAI draw results", worker.includes("/v1/draw/result")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) process.exit(1);
