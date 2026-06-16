import assert from "node:assert/strict";
import { createGrsaiImageClient } from "../apps/api/src/grsai-image-adapter.ts";

async function main() {
  await verifyPendingThenPoll();
  await verifyImmediateSuccess();
  await verifyNanoBananaUsesDedicatedEndpoint();
  await verifyCompletedWithoutImagesFails();
}

async function verifyPendingThenPoll() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/v1/draw/completions")) {
      return jsonResponse(200, {
        code: 0,
        msg: "success",
        data: {
          id: "task-grsai-1",
          status: "pending",
        },
      });
    }
    if (url.endsWith("/v1/draw/result")) {
      return jsonResponse(200, {
        code: 0,
        data: {
          id: "task-grsai-1",
          status: "succeeded",
          results: [{ url: "https://cdn.example.test/grsai-image.png" }],
        },
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher,
    pollIntervalMs: 0,
    timeoutMs: 1000,
  });

  const result = await client.generate({
    modelId: "gpt-image-2",
    prompt: "test",
    aspectRatio: "3:4",
    size: "800x1200",
    images: ["https://example.test/reference.png"],
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/grsai-image.png"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, "https://api.grsai.com/v1/draw/completions");
  assert.equal(calls[1]?.url, "https://api.grsai.com/v1/draw/result");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[1]?.init?.method, "POST");
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.authorization, "Bearer grsai-test-key");

  const submitPayload = JSON.parse(String(calls[0]?.init?.body || "{}"));
  const pollPayload = JSON.parse(String(calls[1]?.init?.body || "{}"));
  assert.deepEqual(submitPayload, {
    model: "gpt-image-2",
    prompt: "test",
    webHook: "-1",
    aspectRatio: "3:4",
    size: "800x1200",
    urls: ["https://example.test/reference.png"],
  });
  assert.deepEqual(pollPayload, {
    taskId: "task-grsai-1",
    id: "task-grsai-1",
  });

  console.log("PASS grsai image adapter submits and polls draw tasks");
}

async function verifyImmediateSuccess() {
  const fetcher: typeof fetch = async () =>
    jsonResponse(200, {
      msg: "success",
      status: "succeeded",
      results: [{ url: "https://cdn.example.test/immediate.png" }],
    });

  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher,
    pollIntervalMs: 0,
    timeoutMs: 1000,
  });

  const result = await client.generate({
    modelId: "gpt-image-2",
    prompt: "test immediate",
    aspectRatio: "1:1",
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/immediate.png"]);
  console.log("PASS grsai image adapter accepts immediate success payloads");
}

async function verifyNanoBananaUsesDedicatedEndpoint() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/v1/draw/nano-banana")) {
      return jsonResponse(200, {
        code: 0,
        data: {
          id: "task-grsai-nano-1",
          status: "pending",
        },
      });
    }
    if (url.endsWith("/v1/draw/result")) {
      return jsonResponse(200, {
        code: 0,
        data: {
          id: "task-grsai-nano-1",
          status: "succeeded",
          results: [{ url: "https://cdn.example.test/grsai-nano-image.png" }],
        },
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher,
    pollIntervalMs: 0,
    timeoutMs: 1000,
  });

  const result = await client.generate({
    modelId: "nano-banana-fast",
    prompt: "nano prompt",
    aspectRatio: "9:16",
    size: "1K",
    images: ["https://example.test/nano-reference.png"],
  });

  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/grsai-nano-image.png"]);
  assert.equal(calls[0]?.url, "https://api.grsai.com/v1/draw/nano-banana");
  console.log("PASS grsai nano-banana models use the dedicated endpoint");
}

async function verifyCompletedWithoutImagesFails() {
  const client = createGrsaiImageClient({
    apiKey: "grsai-test-key",
    baseUrl: "https://api.grsai.com",
    fetcher: async () =>
      jsonResponse(200, {
        code: 0,
        data: {
          id: "task-grsai-empty-1",
          status: "succeeded",
          results: [],
        },
      }),
    pollIntervalMs: 0,
    timeoutMs: 1000,
  });

  await assert.rejects(
    () =>
      client.generate({
        modelId: "gpt-image-2",
        prompt: "empty result should fail",
      }),
    /未返回|缺少.*results|没有返回/i,
  );
  console.log("PASS grsai empty completed payloads are treated as failures");
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
