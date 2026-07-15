import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { prepareGrsaiReferenceImages, prepareInlineImageReferences } from "./grsai-reference-images";

describe("grsai reference images", () => {
  it("inlines safe local input image references and preserves remote references", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user/with unsafe chars";
    const safeOwnerId = "user_with_unsafe_chars";
    const imageDir = join(dataDir, "users", safeOwnerId, "input");
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "sample.png"), Buffer.from([137, 80, 78, 71]));

    const prepared = await prepareGrsaiReferenceImages({
      dataDir,
      ownerId,
      values: ["input/sample.png", "https://example.test/image.png"],
    });

    expect(prepared[0]).toBe("data:image/png;base64,iVBORw==");
    expect(prepared[1]).toBe("https://example.test/image.png");
  });

  it("inlines signed provider-file URLs for the same owner and rejects unrelated remote URLs", async ({ task }) => {
    const dataDir = join(process.cwd(), "runtime", "test-fixtures", task.id);
    const ownerId = "user-admin";
    const imageDir = join(dataDir, "users", ownerId, "input");
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "one.png"), Buffer.from([137, 80, 78, 71]));

    const prepared = await prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: ["https://files.example.test/api/provider-files/gray/user-admin/input/one.png?exp=1&sig=hidden"],
    });
    expect(prepared).toEqual(["data:image/png;base64,iVBORw=="]);

    await expect(prepareInlineImageReferences({
      dataDir,
      ownerId,
      values: ["https://unrelated.example.test/image.png"],
    })).rejects.toThrow("不是当前账号的本地素材");
  });
});
