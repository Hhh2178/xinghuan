import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf-8");
const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf-8");

const checks = [
  ["Worker no longer calls executeMockTask", !worker.includes("executeMockTask(")],
  ["Worker reads task provider/model/payload", /select[\s\S]*provider_id[\s\S]*model_id[\s\S]*payload[\s\S]*from xh_tasks/i.test(worker)],
  ["Worker reads provider and model records", /join xh_providers/i.test(worker) && /join xh_models/i.test(worker)],
  ["Worker decrypts provider key inside worker boundary", worker.includes("decryptSecret(") && worker.includes("XINGHUAN_SECRET_KEY")],
  ["Worker has image adapter execution", worker.includes("executeImageTask") && worker.includes("/images/generations")],
  ["Worker records adapter result metadata", worker.includes("imageUrls") && worker.includes("completedAt")],
  ["API task record exposes payload and result", api.includes("payload?: Record<string, unknown>") && api.includes("result?: Record<string, unknown>")],
  ["API postgres task repository persists payload and result", /insert into xh_tasks[\s\S]*payload[\s\S]*result/i.test(api) && /select[\s\S]*payload[\s\S]*result[\s\S]*from xh_tasks/i.test(api)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
