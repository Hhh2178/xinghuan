import { strict as assert } from "node:assert";

import { fetchPollResponseWithRetry } from "../apps/worker/src/worker-transient-poll-retry.js";

await verifyGatewayRecovery();
await verifyNetworkAndRetryAfterRecovery();
await verifyOrdinaryClientErrorIsNotRetried();
await verifyRetryLimit();
await verifyRetryObserverFailurePropagates();
await verifyNetworkDiagnosticSanitization();

console.log(JSON.stringify({ ok: true }, null, 2));

async function verifyGatewayRecovery() {
  const responses = [
    new Response("gateway", { status: 502 }),
    new Response('{"status":"completed"}', { status: 200 }),
  ];
  const delays: number[] = [];
  const retries: Array<Record<string, unknown>> = [];
  let requestCount = 0;
  const result = await fetchPollResponseWithRetry({
    request: async () => {
      requestCount += 1;
      return responses.shift()!;
    },
    baseDelayMs: 100,
    maxDelayMs: 500,
    random: () => 0.5,
    wait: async (delayMs) => { delays.push(delayMs); },
    onRetry: async (event) => { retries.push(event as unknown as Record<string, unknown>); },
  });
  assert.equal(requestCount, 2);
  assert.equal(result.response.status, 200);
  assert.equal(result.retryCount, 1);
  assert.deepEqual(delays, [100]);
  assert.deepEqual(retries.map((event) => event.statusCode), [502]);
}

async function verifyNetworkAndRetryAfterRecovery() {
  let requestCount = 0;
  const delays: number[] = [];
  const result = await fetchPollResponseWithRetry({
    request: async () => {
      requestCount += 1;
      if (requestCount === 1) throw new TypeError("fetch failed");
      if (requestCount === 2) return new Response("busy", { status: 503, headers: { "retry-after": "2" } });
      return new Response("ok", { status: 200 });
    },
    baseDelayMs: 100,
    maxDelayMs: 500,
    random: () => 0.5,
    wait: async (delayMs) => { delays.push(delayMs); },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.retryCount, 2);
  assert.deepEqual(delays, [100, 500]);
}

async function verifyOrdinaryClientErrorIsNotRetried() {
  let requestCount = 0;
  const result = await fetchPollResponseWithRetry({
    request: async () => {
      requestCount += 1;
      return new Response("bad request", { status: 400 });
    },
    wait: async () => { throw new Error("400 must not wait or retry"); },
  });
  assert.equal(requestCount, 1);
  assert.equal(result.response.status, 400);
  assert.equal(result.retryCount, 0);
}

async function verifyRetryLimit() {
  let requestCount = 0;
  const result = await fetchPollResponseWithRetry({
    request: async () => {
      requestCount += 1;
      return new Response("gateway", { status: 502 });
    },
    maxRetries: 2,
    baseDelayMs: 1,
    maxDelayMs: 2,
    random: () => 0.5,
    wait: async () => undefined,
  });
  assert.equal(requestCount, 3);
  assert.equal(result.response.status, 502);
  assert.equal(result.retryCount, 2);
}

async function verifyRetryObserverFailurePropagates() {
  let requestCount = 0;
  await assert.rejects(
    () => fetchPollResponseWithRetry({
      request: async () => {
        requestCount += 1;
        return new Response("gateway", { status: 502 });
      },
      onRetry: async () => { throw new Error("heartbeat unavailable"); },
      wait: async () => undefined,
    }),
    /heartbeat unavailable/,
  );
  assert.equal(requestCount, 1);
}

async function verifyNetworkDiagnosticSanitization() {
  const retries: Array<Record<string, unknown>> = [];
  let requestCount = 0;
  await fetchPollResponseWithRetry({
    request: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        throw new Error("fetch https://provider.example/tasks/one?sig=private&token=hidden with Bearer private-token failed");
      }
      return new Response("ok", { status: 200 });
    },
    baseDelayMs: 0,
    maxDelayMs: 0,
    wait: async () => undefined,
    onRetry: async (event) => { retries.push(event as unknown as Record<string, unknown>); },
  });
  assert.equal(requestCount, 2);
  assert.match(String(retries[0]?.error || ""), /\?\[redacted\]/);
  assert.match(String(retries[0]?.error || ""), /Bearer \[redacted\]/);
  assert.doesNotMatch(String(retries[0]?.error || ""), /private|hidden/);
}
