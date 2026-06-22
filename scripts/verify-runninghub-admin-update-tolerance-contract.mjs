import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(
  source,
  /patch\.workflowJson === undefined \? preserveRunningHubJsonText\(entry\.workflowJson, ""\) : safeRunningHubJsonText\(patch\.workflowJson, ""\)/,
  "update should tolerate legacy workflowJson when patch does not touch it",
);
assert.match(
  source,
  /patch\.parameterSchema === undefined \? preserveRunningHubObjectJsonText\(entry\.parameterSchema, "\{\}"\) : safeRunningHubObjectJsonText\(patch\.parameterSchema, "\{\}"\)/,
  "update should tolerate legacy parameterSchema when patch does not touch it",
);
assert.match(
  source,
  /patch\.testPayload === undefined \? preserveRunningHubJsonText\(entry\.testPayload, "\{\}"\) : safeRunningHubJsonText\(patch\.testPayload, "\{\}"\)/,
  "update should tolerate legacy testPayload when patch does not touch it",
);
assert.match(
  source,
  /const text = safeLongText\(value, "", \d+\);/,
  "runninghub json validation should read long text without default safeText truncation",
);

console.log("PASS runninghub admin update tolerance contract");
