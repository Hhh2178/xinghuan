import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../apps/worker/src/worker-runninghub-client.ts", import.meta.url), "utf8");

const checks = [
  [
    "Workflow submit body carries apiKey instead of apiKeyOnly",
    /apiKey:\s*options\.apiKey[\s\S]*workflowId:\s*workflowId \|\| runTargetId[\s\S]*nodeInfoList/i.test(client),
  ],
  [
    "Worker no longer uses apiKeyOnly in RunningHub workflow submit body",
    !/apiKeyOnly\s*:/.test(client),
  ],
  [
    "RunningHub submit failures persist structured upstream diagnostics",
    /rhFailureStage[\s\S]*rhSubmitUrl[\s\S]*rhSubmitRequest[\s\S]*rhSubmitResponseStatus[\s\S]*rhSubmitResponseText/i.test(client),
  ],
  [
    "AI App submit uses official v2 route",
    /targetType === "app"[\s\S]*\/openapi\/v2\/run\/ai-app\//.test(client),
  ],
  [
    "AI App query uses v2 query route",
    /\/openapi\/v2\/query/.test(client),
  ],
  [
    "AI App submit body no longer sends taskType ASYNC old-form payload",
    !/taskType:\s*"ASYNC"/.test(client),
  ],
  [
    "Worker routes RunningHub execution through dedicated client module",
    /createRunningHubClient/.test(worker) && /worker-runninghub-client/.test(worker),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
