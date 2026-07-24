import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readSerializedJson, writeSerializedJson } from "./serialized-json-file.js";

describe("serialized JSON file access", () => {
  it("never exposes a partially written document to concurrent in-process readers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "xinghuan-serialized-json-"));
    const path = join(directory, "admin.json");
    await writeSerializedJson(path, { revision: 0, payload: "initial" });

    const parseFailures: unknown[] = [];
    for (let revision = 1; revision <= 30; revision += 1) {
      await Promise.all([
        writeSerializedJson(path, { revision, payload: "x".repeat(16_384) }),
        ...Array.from({ length: 8 }, async () => {
          try {
            await readSerializedJson(path);
          } catch (error) {
            parseFailures.push(error);
          }
        }),
      ]);
    }

    expect(parseFailures).toEqual([]);
    await expect(readSerializedJson(path)).resolves.toMatchObject({ revision: 30 });
  });

  it("surfaces invalid JSON instead of replacing it with defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "xinghuan-invalid-json-"));
    const path = join(directory, "admin.json");
    await writeFile(path, "{incomplete", "utf8");

    await expect(readSerializedJson(path)).rejects.toBeInstanceOf(SyntaxError);
  });
});
