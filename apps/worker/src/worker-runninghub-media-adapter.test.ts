import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { materializeRunningHubNodeInfo } from "./worker-runninghub-media-adapter.js";

describe("RunningHub worker media adapter", () => {
  it("uploads only the current owner's output artifact and replaces it with the RunningHub file name", async () => {
    const dataDir = await fixtureDataDir();
    const outputDir = join(dataDir, "users", "owner-1", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "shot.png"), "image");
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://rh.example/task/openapi/upload");
      expect((init?.body as FormData).get("apiKey")).toBe("key");
      expect((init?.body as FormData).get("fileType")).toBe("input");
      expect((init?.body as FormData).get("file")).toBeInstanceOf(Blob);
      return new Response(JSON.stringify({ data: { fileName: "rh-shot.png", fileType: "image" } }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(materializeRunningHubNodeInfo({
      dataDir,
      ownerId: "owner-1",
      baseUrl: "https://rh.example",
      apiKey: "key",
      nodeInfoList: [{ nodeId: "1", fieldName: "image", fieldValue: "/files/output/shot.png" }],
      fetcher,
    })).resolves.toEqual([{ nodeId: "1", fieldName: "image", fieldValue: "rh-shot.png" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects remote URLs and traversal before an upload request is made", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(materializeRunningHubNodeInfo({
      dataDir: await fixtureDataDir(),
      ownerId: "owner-1",
      baseUrl: "https://rh.example",
      apiKey: "key",
      nodeInfoList: [{ nodeId: "1", fieldName: "image", fieldValue: "https://example.invalid/private.png" }],
      fetcher,
    })).rejects.toThrow("RUNNINGHUB_MEDIA_URL_UNSUPPORTED");
    await expect(materializeRunningHubNodeInfo({
      dataDir: await fixtureDataDir(),
      ownerId: "owner-1",
      baseUrl: "https://rh.example",
      apiKey: "key",
      nodeInfoList: [{ nodeId: "1", fieldName: "image", fieldValue: "/files/output/..%2Fother.png" }],
      fetcher,
    })).rejects.toThrow("RUNNINGHUB_MEDIA_URL_INVALID");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves ordinary RunningHub file names without attempting another upload", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(materializeRunningHubNodeInfo({
      dataDir: await fixtureDataDir(),
      ownerId: "owner-1",
      baseUrl: "https://rh.example",
      apiKey: "key",
      nodeInfoList: [{ nodeId: "1", fieldName: "image", fieldValue: "existing-rh-file.png" }, { nodeId: "2", fieldName: "prompt", fieldValue: "city rain" }],
      fetcher,
    })).resolves.toEqual([{ nodeId: "1", fieldName: "image", fieldValue: "existing-rh-file.png" }, { nodeId: "2", fieldName: "prompt", fieldValue: "city rain" }]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

async function fixtureDataDir() {
  const dir = join(tmpdir(), `xinghuan-rh-media-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}
