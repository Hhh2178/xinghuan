import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const mediaPolling = await readFile(new URL("../apps/worker/src/worker-media-polling.ts", import.meta.url), "utf8");

assert.match(worker, /from "\.\/worker-media-polling\.js"/, "worker.ts should import extracted media polling helpers");
assert.match(worker, /pollApimartVideoTask/, "worker.ts should keep delegating video polling through extracted helper");
assert.match(worker, /pollApimartImageTask/, "worker.ts should keep delegating image polling through extracted helper");
assert.match(worker, /pollModelScopeImageTask/, "worker.ts should keep delegating ModelScope polling through extracted helper");
assert.doesNotMatch(worker, /async function pollApimartVideoTask\(/, "worker.ts should not keep pollApimartVideoTask inline after split");
assert.doesNotMatch(worker, /async function fetchFinalApimartVideoResult\(/, "worker.ts should not keep fetchFinalApimartVideoResult inline after split");
assert.doesNotMatch(worker, /async function pollApimartImageTask\(/, "worker.ts should not keep pollApimartImageTask inline after split");
assert.doesNotMatch(worker, /async function pollModelScopeImageTask\(/, "worker.ts should not keep pollModelScopeImageTask inline after split");
assert.doesNotMatch(worker, /function extractModelScopeImageTask\(/, "worker.ts should not keep ModelScope task extraction inline after split");
assert.doesNotMatch(worker, /function modelScopeHeaders\(/, "worker.ts should not keep ModelScope headers inline after split");
assert.doesNotMatch(worker, /function isCompletedAsyncStatus\(/, "worker.ts should not keep async status completion helper inline after split");
assert.doesNotMatch(worker, /function isFailedAsyncStatus\(/, "worker.ts should not keep async status failure helper inline after split");
assert.doesNotMatch(worker, /function readPathText\(/, "worker.ts should not keep async polling path reader inline after split");

assert.match(mediaPolling, /export async function pollApimartVideoTask\(/, "media polling helper should export APIMart video polling");
assert.match(mediaPolling, /export async function fetchFinalApimartVideoResult\(/, "media polling helper should export final APIMart video fetch");
assert.match(mediaPolling, /export async function pollApimartImageTask\(/, "media polling helper should export APIMart image polling");
assert.match(mediaPolling, /export async function pollModelScopeImageTask\(/, "media polling helper should export ModelScope image polling");
assert.match(mediaPolling, /export function extractModelScopeImageTask\(/, "media polling helper should export ModelScope task extraction");
assert.match(mediaPolling, /export function modelScopeHeaders\(/, "media polling helper should export ModelScope headers");
assert.match(mediaPolling, /export function isCompletedAsyncStatus\(/, "media polling helper should export async completion status helper");
assert.match(mediaPolling, /export function isFailedAsyncStatus\(/, "media polling helper should export async failure status helper");
assert.match(mediaPolling, /export function readPathText\(/, "media polling helper should export polling path reader");
assert.match(mediaPolling, /runtimeStage:\s*"polling"/, "media polling helper should preserve polling runtime heartbeat stage");
assert.match(mediaPolling, /buildUpstreamBusinessFailurePatch/, "media polling helper should preserve upstream business failure normalization");

console.log("PASS worker media polling split contract");
