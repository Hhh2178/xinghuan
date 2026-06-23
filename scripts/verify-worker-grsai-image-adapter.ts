import assert from "node:assert/strict";
import { createGrsaiImageClient } from "../apps/worker/src/worker-grsai-image-client.ts";

async function main() {
  await verifyPendingTaskEventuallySucceeds();
  await verifyImmediateSuccessReturnsImages();
  await verifyNonJsonGatewayPollFailuresAreRetried();
  await verifyJsonGatewayPollFailuresAreRetried();
  await verifyRetryableGatewayPollFailuresEventuallyExhaust();
  await verifySuccessWithoutImagesFailsAsBusinessFailure();
}

async function verifyPendingTaskEventuallySucceeds() {
  let pollAttempts = 0;
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/draw/completions")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-pending-1",
            status: "pending",
          },
        });
      }
      if (url.endsWith("/v1/draw/result")) {
        pollAttempts += 1;
        if (pollAttempts === 1) {
          return jsonResponse(200, {
            code: 0,
            data: {
              id: "worker-task-grsai-pending-1",
              status: "running",
            },
          });
        }
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-pending-1",
            status: "succeeded",
            results: [{ url: "https://cdn.example.test/worker-grsai-pending-image.png" }],
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    pollIntervalMs: 0,
    timeoutMs: 5000,
  });

  const heartbeats: Array<Record<string, unknown>> = [];
  const result = await client.generate({
    modelId: "gpt-image-2",
    prompt: "worker pending to success",
    onHeartbeat: (patch) => {
      heartbeats.push(patch);
    },
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/worker-grsai-pending-image.png"]);
  assert.equal(result.taskId, "worker-task-grsai-pending-1");
  assert.equal(pollAttempts, 2);
  assert.ok(heartbeats.length >= 2);
  console.log("PASS worker grsai client supports pending -> success polling path");
}

async function verifyImmediateSuccessReturnsImages() {
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/draw/nano-banana")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-immediate-1",
            status: "succeeded",
            results: [{ url: "https://cdn.example.test/worker-grsai-immediate-image.png" }],
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    pollIntervalMs: 0,
    timeoutMs: 5000,
  });

  const result = await client.generate({
    modelId: "nano-banana-v1",
    prompt: "worker immediate success",
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/worker-grsai-immediate-image.png"]);
  assert.equal(result.taskId, "worker-task-grsai-immediate-1");
  console.log("PASS worker grsai client returns immediate success payloads without polling");
}

async function verifyNonJsonGatewayPollFailuresAreRetried() {
  let pollAttempts = 0;
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/draw/completions")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-retry-1",
            status: "pending",
          },
        });
      }
      if (url.endsWith("/v1/draw/result")) {
        pollAttempts += 1;
        if (pollAttempts <= 2) {
          return textResponse(502, "<html><body>temporarily unavailable</body></html>", "text/html");
        }
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-retry-1",
            status: "succeeded",
            results: [{ url: "https://cdn.example.test/worker-grsai-retry-image.png" }],
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    pollIntervalMs: 0,
    timeoutMs: 5000,
  });

  const result = await client.generate({
    modelId: "gpt-image-2",
    prompt: "worker retry html gateway body",
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/worker-grsai-retry-image.png"]);
  assert.equal(pollAttempts, 3);
  console.log("PASS worker grsai client retries non-JSON gateway poll failures by HTTP status");
}

async function verifyJsonGatewayPollFailuresAreRetried() {
  let pollAttempts = 0;
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/draw/completions")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-json-retry-1",
            status: "pending",
          },
        });
      }
      if (url.endsWith("/v1/draw/result")) {
        pollAttempts += 1;
        if (pollAttempts <= 2) {
          return jsonResponse(502, {
            code: 502,
            message: "temporarily unavailable",
          });
        }
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-json-retry-1",
            status: "succeeded",
            results: [{ url: "https://cdn.example.test/worker-grsai-json-retry-image.png" }],
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    pollIntervalMs: 0,
    timeoutMs: 5000,
  });

  const result = await client.generate({
    modelId: "gpt-image-2",
    prompt: "worker retry json gateway body",
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/worker-grsai-json-retry-image.png"]);
  assert.equal(pollAttempts, 3);
  console.log("PASS worker grsai client retries JSON gateway poll failures by HTTP status");
}

async function verifyRetryableGatewayPollFailuresEventuallyExhaust() {
  let pollAttempts = 0;
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/draw/completions")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-exhaust-1",
            status: "pending",
          },
        });
      }
      if (url.endsWith("/v1/draw/result")) {
        pollAttempts += 1;
        return textResponse(503, "temporarily unavailable", "text/plain");
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    pollIntervalMs: 0,
    timeoutMs: 30000,
  });

  await assert.rejects(
    () => client.generate({ modelId: "gpt-image-2", prompt: "worker retry exhaustion" }),
    (error: unknown) => {
      const typed = error as {
        message?: string;
        resultPatch?: { upstreamHttpStatus?: number; upstreamResponseSnippet?: string };
      };
      assert.match(String(typed.message || ""), /temporarily unavailable/i);
      assert.equal(typed.resultPatch?.upstreamHttpStatus, 503);
      assert.match(String(typed.resultPatch?.upstreamResponseSnippet || ""), /temporarily unavailable/i);
      return true;
    },
  );
  assert.equal(pollAttempts, 5);
  console.log("PASS worker grsai client preserves status and body snippet after retry exhaustion");
}

async function verifySuccessWithoutImagesFailsAsBusinessFailure() {
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/draw/completions")) {
        return jsonResponse(200, {
          code: 0,
          data: {
            id: "worker-task-grsai-missing-image-1",
            status: "succeeded",
            message: "ok",
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    pollIntervalMs: 0,
    timeoutMs: 5000,
  });

  await assert.rejects(
    () => client.generate({ modelId: "gpt-image-2", prompt: "worker success without image" }),
    (error: unknown) => {
      const typed = error as {
        message?: string;
        resultPatch?: {
          failureCategory?: string;
          providerDiagnostic?: string;
          upstreamResponseSnippet?: string;
        };
      };
      assert.match(String(typed.message || ""), /未返回图片/i);
      assert.equal(typed.resultPatch?.failureCategory, "upstream_business_failed");
      assert.match(String(typed.resultPatch?.providerDiagnostic || ""), /未返回图片/i);
      assert.match(String(typed.resultPatch?.upstreamResponseSnippet || ""), /succeeded|ok/i);
      return true;
    },
  );
  console.log("PASS worker grsai client converts success-without-images into business failure");
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(status: number, body: string, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
