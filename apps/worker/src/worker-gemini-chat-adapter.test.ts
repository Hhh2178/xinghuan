import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { executeGeminiChatTask } from "./worker-gemini-chat-adapter.js";

describe("Gemini chat media adapter", () => {
  it("honors a caller cancellation signal before starting a Gemini request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(executeGeminiChatTask({
      dataDir: "data",
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Stop." }],
      signal: controller.signal,
      fetchImpl: async (_input, init = {}) => {
        if (init.signal?.aborted) throw new Error("GEMINI_TASK_CANCELLED");
        return Response.json({ candidates: [{ content: { parts: [{ text: "unexpected" }] } }] });
      },
    })).rejects.toThrow("GEMINI_TASK_CANCELLED");
  });

  it("cleans up an uploaded provider file when cancellation occurs before generation", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gemini-video-cancel-"));
    const outputDir = join(dataDir, "users", "owner-a", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "candidate.mp4"), "video-bytes");
    const controller = new AbortController();
    const methods: string[] = [];

    await expect(executeGeminiChatTask({
      dataDir,
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Evaluate." }],
      nativeVideo: { fileUrl: "/files/output/candidate.mp4", mimeType: "video/mp4" },
      signal: controller.signal,
      fetchImpl: async (rawInput, init = {}) => {
        const method = init.method || "GET";
        methods.push(method);
        const url = String(rawInput);
        if (method === "POST" && url.endsWith("/upload/v1beta/files")) return new Response("", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/session/cancel" } });
        if (method === "PUT") {
          controller.abort();
          return Response.json({ file: { name: "files/cancel", uri: "https://generativelanguage.googleapis.com/v1beta/files/cancel", state: "ACTIVE" } });
        }
        if (method === "DELETE") {
          expect(init.signal?.aborted).toBe(false);
          return new Response("", { status: 204 });
        }
        throw new Error(`unexpected request ${method} ${url}`);
      },
    })).rejects.toThrow("GEMINI_TASK_CANCELLED");

    expect(methods).toEqual(["POST", "PUT", "DELETE"]);
  });

  it("uploads an owner-scoped video, waits for ACTIVE, analyzes it, and deletes the provider file", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gemini-video-adapter-"));
    const outputDir = join(dataDir, "users", "owner-a", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "candidate.mp4"), "video-bytes");
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init = {}) => {
      const url = String(input);
      const method = init.method || "GET";
      requests.push({ url, method, body: init.body });
      if (method === "POST" && url.endsWith("/upload/v1beta/files")) {
        return new Response("", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/session/one" } });
      }
      if (method === "PUT") {
        return Response.json({ file: { name: "files/one", uri: "https://generativelanguage.googleapis.com/v1beta/files/one", state: "PROCESSING" } });
      }
      if (method === "GET" && url.endsWith("/v1beta/files/one")) {
        return Response.json({ name: "files/one", uri: "https://generativelanguage.googleapis.com/v1beta/files/one", state: "ACTIVE" });
      }
      if (method === "POST" && url.includes(":generateContent")) {
        return Response.json({ candidates: [{ content: { parts: [{ text: "{\"technicalValidity\":95}" }] }, finishReason: "STOP" }] });
      }
      if (method === "DELETE") return new Response("", { status: 204 });
      throw new Error(`unexpected request ${method} ${url}`);
    };

    const result = await executeGeminiChatTask({
      dataDir,
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Evaluate the complete video." }],
      nativeVideo: { fileUrl: "/files/output/candidate.mp4", mimeType: "video/mp4" },
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(result).toMatchObject({ adapter: "gemini-generate-content", content: "{\"technicalValidity\":95}", finishReason: "STOP" });
    expect(requests.map((request) => request.method)).toEqual(["POST", "PUT", "GET", "POST", "DELETE"]);
    const generateRequest = requests.find((request) => request.url.includes(":generateContent"));
    const payload = JSON.parse(String(generateRequest?.body));
    expect(payload.contents[0].parts).toEqual(expect.arrayContaining([
      { text: "Evaluate the complete video." },
      { file_data: { mime_type: "video/mp4", file_uri: "https://generativelanguage.googleapis.com/v1beta/files/one" } },
    ]));
  });

  it("rejects traversal before contacting Gemini", async () => {
    let called = false;
    await expect(executeGeminiChatTask({
      dataDir: "data",
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Evaluate." }],
      nativeVideo: { fileUrl: "/files/output/..%2Fsecret.mp4", mimeType: "video/mp4" },
      fetchImpl: async () => {
        called = true;
        return new Response();
      },
    })).rejects.toThrow("GEMINI_MEDIA_URL_INVALID");
    expect(called).toBe(false);
  });

  it("reports upload start failure without attempting cleanup for a file that was never created", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gemini-video-start-failure-"));
    const outputDir = join(dataDir, "users", "owner-a", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "candidate.mp4"), "video-bytes");
    const methods: string[] = [];

    await expect(executeGeminiChatTask({
      dataDir,
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Evaluate." }],
      nativeVideo: { fileUrl: "/files/output/candidate.mp4", mimeType: "video/mp4" },
      fetchImpl: async (_input, init = {}) => {
        methods.push(init.method || "GET");
        return new Response("unavailable", { status: 503 });
      },
    })).rejects.toThrow("GEMINI_FILE_START_FAILED:503");
    expect(methods).toEqual(["POST"]);
  });

  it("cleans up a provider file when processing never becomes active", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gemini-video-processing-timeout-"));
    const outputDir = join(dataDir, "users", "owner-a", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "candidate.mp4"), "video-bytes");
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (rawInput, init = {}) => {
      const url = String(rawInput);
      const method = init.method || "GET";
      methods.push(method);
      if (method === "POST" && url.endsWith("/upload/v1beta/files")) return new Response("", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/session/timeout" } });
      if (method === "PUT") return Response.json({ file: { name: "files/timeout", uri: "", state: "PROCESSING" } });
      if (method === "GET") return Response.json({ name: "files/timeout", uri: "", state: "PROCESSING" });
      if (method === "DELETE") return new Response("", { status: 204 });
      throw new Error(`unexpected request ${method} ${url}`);
    };

    await expect(executeGeminiChatTask({
      dataDir,
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Evaluate." }],
      nativeVideo: { fileUrl: "/files/output/candidate.mp4", mimeType: "video/mp4" },
      fetchImpl,
      sleep: async () => undefined,
    })).rejects.toThrow("GEMINI_FILE_NOT_ACTIVE:PROCESSING");
    expect(methods.filter((method) => method === "GET")).toHaveLength(60);
    expect(methods.at(-1)).toBe("DELETE");
  });

  it("cleans up the provider file when generateContent fails", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gemini-video-generate-failure-"));
    const outputDir = join(dataDir, "users", "owner-a", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "candidate.mp4"), "video-bytes");
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (rawInput, init = {}) => {
      const url = String(rawInput);
      const method = init.method || "GET";
      methods.push(method);
      if (method === "POST" && url.endsWith("/upload/v1beta/files")) return new Response("", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload/session/generate-failure" } });
      if (method === "PUT") return Response.json({ file: { name: "files/generate-failure", uri: "https://generativelanguage.googleapis.com/v1beta/files/generate-failure", state: "ACTIVE" } });
      if (method === "POST" && url.includes(":generateContent")) return new Response("upstream failure", { status: 500 });
      if (method === "DELETE") return new Response("", { status: 204 });
      throw new Error(`unexpected request ${method} ${url}`);
    };

    await expect(executeGeminiChatTask({
      dataDir,
      ownerId: "owner-a",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      modelId: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Evaluate." }],
      nativeVideo: { fileUrl: "/files/output/candidate.mp4", mimeType: "video/mp4" },
      fetchImpl,
    })).rejects.toThrow("GEMINI_GENERATE_FAILED:500");
    expect(methods).toEqual(["POST", "PUT", "POST", "DELETE"]);
  });
});
