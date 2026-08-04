import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOutputArchiveRepository } from "./output-archive-repository.js";

describe("output archive repository", () => {
  it("resolves only materialized owner output files", async () => {
    const root = await mkdtemp(join(tmpdir(), "xh-archive-"));
    const outputDir = join(root, "output");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "image.png"), "image-bytes");
    const repository = createOutputArchiveRepository({
      getPostgresPool: async () => ({ query: async () => ({ rows: [] }) } as any),
      usePostgresRepository: () => true,
      readTaskRecord: async () => ({
        id: "task-1",
        title: "RH output",
        status: "succeeded",
        result: { materializedImageUrls: ["/files/output/image.png"] },
        logs: [],
        createdAt: 1,
        updatedAt: 1,
      }),
      userDataDirs: () => ({ baseDir: root, outputDir }),
    });

    const files = await repository.resolveSourceFiles("owner-1", {
      id: "task-1",
      title: "RH output",
      status: "succeeded",
      result: { materializedImageUrls: ["/files/output/image.png"] },
      logs: [],
      createdAt: 1,
      updatedAt: 1,
    });

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ kind: "image", sourceUrl: "/files/output/image.png", sourceBytes: 11 });
    expect(files[0]?.absolutePath).toBe(join(outputDir, "image.png"));
  });

  it("rejects traversal and non-terminal tasks", async () => {
    const root = await mkdtemp(join(tmpdir(), "xh-archive-"));
    const outputDir = join(root, "output");
    await mkdir(outputDir, { recursive: true });
    const repository = createOutputArchiveRepository({
      getPostgresPool: async () => ({ query: async () => ({ rows: [] }) } as any),
      usePostgresRepository: () => true,
      readTaskRecord: async () => null,
      userDataDirs: () => ({ baseDir: root, outputDir }),
    });

    await expect(repository.resolveSourceFiles("owner-1", {
      id: "task-1",
      title: "RH output",
      status: "running",
      result: { materializedImageUrls: ["/files/output/../secret.png"] },
      logs: [],
      createdAt: 1,
      updatedAt: 1,
    })).rejects.toThrow("source_task_not_terminal");
  });
});
