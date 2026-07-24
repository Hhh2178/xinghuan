import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

describe("file-backed AdminDb access", () => {
  it("serializes reads and writes without resetting invalid JSON", () => {
    expect(serverSource).toMatch(/import \{[^}]*fileErrorCode[^}]*readSerializedJson[^}]*writeSerializedJson[^}]*\} from "\.\/serialized-json-file\.js";/);
    expect(serverSource).toContain("db = await readSerializedJson(adminDbPath) as AdminDb;");
    expect(serverSource).toContain("await writeSerializedJson(adminDbPath, db);");
    expect(serverSource).toMatch(/catch \(error\)[\s\S]*fileErrorCode\(error\) !== "ENOENT"[\s\S]*throw error/);
    expect(serverSource).not.toContain('writeFile(adminDbPath, JSON.stringify(db, null, 2), "utf-8")');
  });
});
