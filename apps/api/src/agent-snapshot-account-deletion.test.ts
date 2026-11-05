import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("account deletion with immutable knowledge snapshots", () => {
  it("keeps direct snapshot mutation forbidden while allowing owner deletion", async () => {
    const sql = await readFile(new URL("../db/050_snapshot_account_deletion.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/references xh_users\s*\(id\)\s+on delete cascade/i);
    expect(sql).toMatch(/deferrable initially deferred/i);
    expect(sql).toMatch(/TG_OP\s*=\s*'DELETE'.*not exists\s*\(select 1 from xh_users where id\s*=\s*OLD.owner_id\)/is);
    expect(sql).toMatch(/raise exception 'AGENT_KNOWLEDGE_SNAPSHOT_IMMUTABLE'/i);
  });
});
