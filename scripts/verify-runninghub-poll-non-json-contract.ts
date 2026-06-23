import assert from "node:assert/strict";
import { parseRunningHubPollJsonResponse } from "../apps/worker/src/worker-runninghub-response.ts";

function main() {
  verifyHtmlGatewayBodyFailsAsUnifiedDiagnostic();
  verifyPlainTextBodyFailsAsUnifiedDiagnostic();
  verifyEmptyBodyFailsAsUnifiedDiagnostic();
  verifyValidJsonStillParses();
}

function verifyHtmlGatewayBodyFailsAsUnifiedDiagnostic() {
  const result = parseRunningHubPollJsonResponse("<html><body>temporarily unavailable</body></html>", 200);

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected HTML poll response to fail");
  assert.equal(result.errorMessage, "RunningHub 轮询返回非法 JSON");
  assert.equal(result.resultPatch.failureCategory, "upstream_poll_gateway_failed");
  assert.equal(result.resultPatch.providerDiagnostic, "RunningHub 轮询返回非法 JSON");
  assert.equal(result.resultPatch.upstreamHttpStatus, 200);
  assert.match(String(result.resultPatch.upstreamResponseSnippet), /temporarily unavailable/);
  console.log("PASS runninghub poll html body normalizes into unified failure");
}

function verifyPlainTextBodyFailsAsUnifiedDiagnostic() {
  const result = parseRunningHubPollJsonResponse("temporarily unavailable", 200);

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected plain text poll response to fail");
  assert.equal(result.resultPatch.failureCategory, "upstream_poll_gateway_failed");
  assert.equal(result.resultPatch.upstreamHttpStatus, 200);
  assert.match(String(result.resultPatch.upstreamResponseSnippet), /temporarily unavailable/);
  console.log("PASS runninghub poll plain text body normalizes into unified failure");
}

function verifyEmptyBodyFailsAsUnifiedDiagnostic() {
  const result = parseRunningHubPollJsonResponse("", 200);

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected empty poll response to fail");
  assert.equal(result.resultPatch.failureCategory, "upstream_poll_gateway_failed");
  assert.equal(result.resultPatch.upstreamHttpStatus, 200);
  assert.equal(result.resultPatch.upstreamResponseSnippet, "");
  console.log("PASS runninghub poll empty body normalizes into unified failure");
}

function verifyValidJsonStillParses() {
  const result = parseRunningHubPollJsonResponse('{"status":"SUCCESS","results":[]}', 200);

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected valid poll response to parse");
  assert.deepEqual(result.raw, { status: "SUCCESS", results: [] });
  console.log("PASS runninghub poll valid JSON still parses");
}

main();
