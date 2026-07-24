import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prepareRunningHubStandardMediaValues } from "./worker-runninghub-standard-media.js";

describe("RunningHub standard media upload", () => {
  it("uploads current-owner local and protected media through the v2 binary endpoint", async () => {
    const dataDir = await fixtureDataDir();
    const outputDir = join(dataDir, "users", "owner-1", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "shot.png"), "image");
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://www.runninghub.cn/openapi/v2/media/upload/binary");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-key" });
      const form = init?.body as FormData;
      expect(form.get("file")).toBeInstanceOf(Blob);
      expect(form.has("apiKey")).toBe(false);
      return jsonResponse({ code: 0, message: "success", data: { download_url: "https://temporary.rh/shot.png", fileName: "openapi/shot.png" } });
    }) as unknown as typeof fetch;

    await expect(prepareRunningHubStandardMediaValues({
      dataDir,
      ownerId: "owner-1",
      baseUrl: "https://www.runninghub.cn",
      apiKey: "secret-key",
      values: [
        "/files/output/shot.png",
        "https://canvas.local/api/provider-files/owner-1/output/shot.png?signature=private",
        "https://public.example/reference.png",
      ],
      fetchImpl,
    })).resolves.toEqual([
      "https://temporary.rh/shot.png",
      "https://temporary.rh/shot.png",
      "https://public.example/reference.png",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects traversal and cross-owner protected media before upload", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const input = {
      dataDir: await fixtureDataDir(),
      ownerId: "owner-1",
      baseUrl: "https://www.runninghub.cn",
      apiKey: "secret-key",
      fetchImpl,
    };

    await expect(prepareRunningHubStandardMediaValues({ ...input, values: ["/files/output/..%2Fother.png"] }))
      .rejects.toThrow("RUNNINGHUB_STANDARD_MEDIA_URL_INVALID");
    await expect(prepareRunningHubStandardMediaValues({ ...input, values: ["https://canvas.local/api/provider-files/owner-2/output/shot.png"] }))
      .rejects.toThrow("RUNNINGHUB_STANDARD_MEDIA_OWNER_MISMATCH");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

async function fixtureDataDir() {
  const dir = join(tmpdir(), `xinghuan-rh-standard-media-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
