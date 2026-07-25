import { describe, expect, it } from "vitest";
import { readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EPHEMERAL_UPLOAD_TTL_MS, createEphemeralUploadRepository } from "./ephemeral-upload-repository.js";

describe("ephemeral upload repository", () => {
  it("registers a file with a one-day expiry in file mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "xh-ephemeral-upload-"));
    const manifestPath = join(root, "resources", "ephemeral-uploads.json");
    const repository = createEphemeralUploadRepository({
      usePostgresRepository: () => false,
      getPostgresPool: async () => { throw new Error("postgres should not be used"); },
      manifestPath: () => manifestPath,
      now: () => 1_000,
    });

    const record = await repository.registerOwned("owner-a", {
      filename: "up-1.png",
      url: "/files/input/up-1.png",
      kind: "image",
      mime: "image/png",
      size: 12,
    });

    expect(record.expiresAt).toBe(1_000 + EPHEMERAL_UPLOAD_TTL_MS);
    expect(JSON.parse(await readFile(manifestPath, "utf8")).items).toEqual([
      expect.objectContaining({
        ownerId: "owner-a",
        storageKey: "up-1.png",
        status: "active",
      }),
    ]);
  });

  it("uses an owner-scoped idempotent insert in postgres mode", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const repository = createEphemeralUploadRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({
        async query(sql: string, values: unknown[] = []) {
          calls.push({ sql, values });
          return { rows: [{
            id: "upload-1",
            owner_id: "owner-a",
            storage_key: "up-1.png",
            file_url: "/files/input/up-1.png",
            kind: "image",
            mime: "image/png",
            size_bytes: 12,
            status: "active",
            created_at: new Date(1_000),
            expires_at: new Date(1_000 + EPHEMERAL_UPLOAD_TTL_MS),
          }] };
        },
      }),
      manifestPath: () => "unused",
      now: () => 1_000,
    });

    const record = await repository.registerOwned("owner-a", {
      filename: "up-1.png",
      url: "/files/input/up-1.png",
      kind: "image",
      mime: "image/png",
      size: 12,
    });

    expect(record.id).toBe("upload-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/insert into xh_ephemeral_uploads/i);
    expect(calls[0].sql).toMatch(/on conflict \(owner_id, storage_key\)/i);
  });
});
