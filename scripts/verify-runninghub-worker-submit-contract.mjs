import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");

const checks = [
  [
    "Workflow submit body carries apiKey instead of apiKeyOnly",
    /targetType === "app"[\s\S]*:\s*\{[\s\S]*\}\s*:\s*\{[\s\S]*apiKey:\s*apiKey[\s\S]*workflowId:\s*workflowId \|\| runTargetId[\s\S]*nodeInfoList/i.test(worker),
  ],
  [
    "Worker no longer uses apiKeyOnly in RunningHub workflow submit body",
    !/apiKeyOnly\s*:/.test(worker),
  ],
  [
    "RunningHub submit failures persist structured upstream diagnostics",
    /rhFailureStage[\s\S]*rhSubmitUrl[\s\S]*rhSubmitRequest[\s\S]*rhSubmitResponseStatus[\s\S]*rhSubmitResponseText/i.test(worker),
  ],
  [
    "AI App submit uses official v2 route",
    /targetType === "app"[\s\S]*\/openapi\/v2\/run\/ai-app\//.test(worker),
  ],
  [
    "AI App query uses v2 query route",
    /targetType === "app"[\s\S]*\/openapi\/v2\/query/.test(worker),
  ],
  [
    "AI App submit body no longer sends taskType ASYNC old-form payload",
    !/taskType:\s*"ASYNC"/.test(worker),
  ],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) process.exit(1);
