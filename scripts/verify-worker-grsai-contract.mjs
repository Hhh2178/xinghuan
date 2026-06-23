import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf-8");
const client = await readFile(new URL("../apps/worker/src/worker-grsai-image-client.ts", import.meta.url), "utf-8");

const checks = [
  ["Worker recognizes grsai_draw protocol", worker.includes('"grsai_draw"')],
  ["Worker branches to GRSAI image adapter", worker.includes("executeGrsaiImageTask")],
  ["Worker uses extracted GRSAI image client", worker.includes('createGrsaiImageClient')],
  ["Worker labels GRSAI results", worker.includes('adapter: "grsai-image"')],
  ["Worker forwards GRSAI heartbeat updates", worker.includes("onHeartbeat: (patch) => touchTaskRuntime(task.id, patch)")],
  ["GRSAI client sends draw submission", client.includes("/v1/draw/completions")],
  ["GRSAI client polls draw results", client.includes("/v1/draw/result")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) process.exit(1);
