import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const failureGlue = await readFile(new URL("../apps/worker/src/worker-failure-glue.ts", import.meta.url), "utf8");
const runtimeDiagnostics = await readFile(new URL("../apps/worker/src/worker-runtime-diagnostics.ts", import.meta.url), "utf8");

assert.match(worker, /from "\.\/worker-failure-glue\.js"/, "worker.ts should import extracted worker failure glue helper");
assert.match(worker, /buildWorkerFailureWritebackPatch\(/, "worker.ts should delegate failure writeback patch assembly");
assert.match(worker, /baseResultPatch:\s*buildWorkerFailureWritebackPatch\(/, "worker.ts should pass failure writeback patch into task lifecycle helper");
assert.doesNotMatch(worker, /failureCategory/, "worker.ts should not directly assemble failureCategory after failure glue split");
assert.doesNotMatch(worker, /providerDiagnostic/, "worker.ts should not directly assemble providerDiagnostic after failure glue split");
assert.doesNotMatch(worker, /upstreamHttpStatus/, "worker.ts should not directly assemble upstreamHttpStatus after failure glue split");
assert.doesNotMatch(worker, /upstreamResponseSnippet/, "worker.ts should not directly assemble upstreamResponseSnippet after failure glue split");
assert.match(failureGlue, /export function buildWorkerFailureWritebackPatch\(/, "worker failure glue helper should export writeback patch assembly");
assert.match(failureGlue, /export function normalizeUnifiedFailure\(/, "worker failure glue helper should own failure normalization");
assert.match(failureGlue, /export function readWorkerTaskResultPatch\(/, "worker failure glue helper should own result patch extraction");
assert.match(failureGlue, /export function toOptionalHttpStatus\(/, "worker failure glue helper should own upstream status extraction");
assert.match(failureGlue, /export function toOptionalResponseSnippet\(/, "worker failure glue helper should own upstream snippet extraction");
assert.match(runtimeDiagnostics, /from "\.\/worker-failure-glue\.js"/, "worker runtime diagnostics should re-export from worker failure glue");

console.log("PASS worker failure glue split contract");
