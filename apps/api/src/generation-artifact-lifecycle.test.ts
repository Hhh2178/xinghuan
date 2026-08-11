import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createGenerationArtifactRepository } from "./generation-artifact-repository.js";
import { createGenerationArtifactLifecycle } from "./generation-artifact-lifecycle.js";
import { createLocalArtifactStore } from "./artifact-store.js";

async function createHarness(now = Date.now(), outputRetentionDays = 3) {
  const root = await mkdtemp(join(tmpdir(), "generation-artifact-lifecycle-"));
  const ownerPath = (ownerId: string) => join(root, "users", ownerId, "resources", "generation-library.json");
  const resourcePath = (ownerId: string) => join(root, "users", ownerId, "resources", "resource-library.json");
  const outputDir = (ownerId: string) => join(root, "users", ownerId, "output");
  const repository = createGenerationArtifactRepository({
    usePostgresRepository: () => false,
    getPostgresPool: async () => { throw new Error("postgres should not be used"); },
    generationLibraryPath: ownerPath,
    resourceLibraryPath: resourcePath,
    now: () => now,
  });
  let sequence = 0;
  const lifecycle = createGenerationArtifactLifecycle({
    repository,
    artifactStore: createLocalArtifactStore({ outputDir }),
    createId: () => `gen-test-${++sequence}`,
    readOutputRetentionDays: () => outputRetentionDays,
    now: () => now,
  });
  return { root, ownerPath, resourcePath, outputDir, repository, lifecycle, now };
}

async function createOutput(harness: Awaited<ReturnType<typeof createHarness>>, ownerId: string, filename: string) {
  const path = join(harness.outputDir(ownerId), filename);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(harness.outputDir(ownerId), { recursive: true }));
  await writeFile(path, `artifact:${filename}`, "utf8");
  return `/files/output/${filename}`;
}

describe("GenerationArtifactLifecycle file adapter", () => {
  it("uses the configured retention window for legacy API registration", async () => {
    const harness = await createHarness(2_000_000, 15);
    const fileUrl = await createOutput(harness, "owner-retention", "retention.png");
    const artifact = await harness.lifecycle.registerLegacy("owner-retention", { kind: "image", url: fileUrl });
    expect(artifact.expiresAt - artifact.createdAt).toBe(15 * 24 * 60 * 60 * 1000);
  });

  it("serializes concurrent writes without losing artifacts and keeps list read-only", async () => {
    const harness = await createHarness();
    const ownerId = "owner-a";
    const inputs = await Promise.all(Array.from({ length: 24 }, async (_, index) => {
      const fileUrl = await createOutput(harness, ownerId, `output-${index}.png`);
      return harness.lifecycle.registerLegacy(ownerId, { kind: "image", url: fileUrl, title: `Output ${index}` });
    }));

    expect(new Set(inputs.map((item) => item.id)).size).toBe(24);
    const before = await readFile(harness.ownerPath(ownerId), "utf8");
    const listed = await harness.lifecycle.list(ownerId, { kind: "image" });
    const after = await readFile(harness.ownerPath(ownerId), "utf8");
    expect(listed).toHaveLength(24);
    expect(after).toBe(before);
  });

  it("deduplicates registration and isolates owners", async () => {
    const harness = await createHarness();
    const fileUrl = await createOutput(harness, "owner-a", "same.png");
    const first = await harness.lifecycle.registerLegacy("owner-a", { kind: "image", url: fileUrl, taskId: "task-a" });
    const second = await harness.lifecycle.registerLegacy("owner-a", { kind: "image", url: fileUrl, taskId: "task-a" });
    expect(second.id).toBe(first.id);
    expect(await harness.lifecycle.list("owner-a")).toHaveLength(1);
    expect(await harness.lifecycle.list("owner-b")).toHaveLength(0);
  });

  it("promotes idempotently and protects the binary from generation-library deletion", async () => {
    const harness = await createHarness();
    const ownerId = "owner-promote";
    const fileUrl = await createOutput(harness, ownerId, "promote.png");
    const artifact = await harness.lifecycle.registerLegacy(ownerId, { kind: "image", url: fileUrl, title: "Promote" });
    const first = await harness.lifecycle.promoteOwned(ownerId, artifact.id);
    const resourceBeforeRepeat = await readFile(harness.resourcePath(ownerId), "utf8");
    const second = await harness.lifecycle.promoteOwned(ownerId, artifact.id);
    expect(second.asset.id).toBe(first.asset.id);
    expect(second.asset.url).toBe(fileUrl);
    expect(await readFile(harness.resourcePath(ownerId), "utf8")).toBe(resourceBeforeRepeat);
    const resourceDb = JSON.parse(await readFile(harness.resourcePath(ownerId), "utf8"));
    expect(resourceDb.items).toHaveLength(1);

    await harness.lifecycle.deleteOwned(ownerId, artifact.id);
    await expect(readFile(join(harness.outputDir(ownerId), "promote.png"), "utf8")).resolves.toContain("artifact:");
  });

  it("rejects expired content without mutating the record", async () => {
    const harness = await createHarness(2_000_000);
    const ownerId = "owner-expired";
    const fileUrl = await createOutput(harness, ownerId, "expired.png");
    const artifact = await harness.repository.registerOwned(ownerId, {
      kind: "image",
      title: "Expired",
      storageKey: "expired.png",
      fileUrl,
      expiresAt: harness.now - 1,
    });
    await expect(harness.lifecycle.resolveContent(ownerId, artifact.id)).rejects.toMatchObject({
      statusCode: 410,
      message: "MATERIAL_EXPIRED",
    });
    expect((await harness.repository.findOwned(ownerId, artifact.id))?.status).toBe("active");
  });

  it("does not promote an artifact after a concurrent delete wins", async () => {
    const harness = await createHarness();
    const ownerId = "owner-delete-race";
    const fileUrl = await createOutput(harness, ownerId, "deleted.png");
    const artifact = await harness.lifecycle.registerLegacy(ownerId, { kind: "image", url: fileUrl });
    await harness.lifecycle.deleteOwned(ownerId, artifact.id);
    await expect(harness.repository.promoteOwned(ownerId, artifact.id)).resolves.toBeNull();
    await expect(harness.lifecycle.promoteOwned(ownerId, artifact.id)).rejects.toMatchObject({
      statusCode: 404,
      message: "MATERIAL_NOT_FOUND",
    });
    await expect(readFile(harness.resourcePath(ownerId), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
