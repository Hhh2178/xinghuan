import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = [
  "apps/api/src/output-archive-routes.ts",
  "apps/api/src/output-archive-repository.ts",
  "apps/worker/src/output-archive-worker.ts",
  "apps/worker/src/worker.ts",
];
const sources = await Promise.all(files.map(async (file) => [file, await readFile(resolve(file), "utf8")]));
const all = sources.map(([, source]) => source).join("\n");
const fail = (message) => { console.error(`FAIL ${message}`); process.exitCode = 1; };

if (!all.includes("createOutputArchiveWorker")) fail("archive worker is not wired");
if (!all.includes("acquireGlobalSlot")) fail("global archive lease is missing");
if (!all.includes("createReadStream")) fail("archive inputs are not streamed");
if (all.includes("readFile(") && all.includes("output-archive")) fail("archive path must not buffer complete files");
if (!all.includes("lease_expires_at") || !all.includes("heartbeat_at")) fail("archive lease heartbeat is missing");
if (!all.includes("for update") || !all.includes("skip locked")) fail("archive queue claim is not lock-safe");
if (process.exitCode) process.exit();
console.log("PASS output archive load isolation contract");
