import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createOutputArchiveWorker } from "./output-archive-worker.js";

describe("output archive worker", () => {
  it("serializes one owner job and writes a store zip atomically", async () => {
    const root = join(tmpdir(), `xh-output-archive-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const outputDir = join(root, "users", "owner-a", "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "clip.mp4"), "video-content");
    const calls: string[] = [];
    const pool = {
      query: async (sql: string, _params?: unknown[]) => {
        calls.push(sql.trim().split("\n")[0]);
        if (sql.includes("where (expires_at is not null")) return { rows: [], rowCount: 0 };
        if (sql.includes("set status = 'failed'")) return { rows: [], rowCount: 0 };
        if (sql.includes("update xh_output_archive_dispatch_slots")) return { rows: [{ scope: "global" }], rowCount: 1 };
        if (sql.includes("select distinct owner_id")) return { rows: [{ owner_id: "owner-a" }], rowCount: 1 };
        if (sql.includes("select last_owner_id")) return { rows: [{ last_owner_id: "" }], rowCount: 1 };
        if (sql.includes("returning job.id")) return {
          rows: [{ id: "archive-1", owner_id: "owner-a", source_task_id: "task-1", archive_filename: "rh-task.zip", manifest: {
            sourceTaskId: "task-1", files: [{ sourceUrl: "/files/output/clip.mp4", archivePath: "videos/001-clip.mp4", kind: "video", sourceBytes: 13 }],
          } }], rowCount: 1,
        };
        if (sql.includes("update xh_output_archive_dispatch_cursors")) return { rows: [], rowCount: 1 };
        if (sql.includes("select cancel_requested_at")) return { rows: [{ cancel_requested_at: null }], rowCount: 1 };
        if (sql.includes("set status = 'ready'")) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    } as any;
    const worker = createOutputArchiveWorker({ pool, dataDir: root, workerId: "worker-a", reservedDiskBytes: 0, wait: async () => undefined });
    await expect(worker.tick()).resolves.toBe(true);
    const archivePath = join(root, "users", "owner-a", "output-archives", "archive-1.zip");
    const bytes = await readFile(archivePath);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    expect(await readdir(join(root, "users", "owner-a", "output-archives"))).toEqual(["archive-1.zip"]);
    expect(calls.some((call) => call.includes("update xh_output_archive_dispatch_slots"))).toBe(true);
  });
});
