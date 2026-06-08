import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prepareGrsaiReferenceImages } from "../apps/api/src/grsai-reference-images.js";

const png1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "xinghuan-grsai-refs-"));
  const ownerId = "usr-grsai-ref";
  const inputDir = join(dataDir, "users", ownerId, "input");
  const outputDir = join(dataDir, "users", ownerId, "output");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(inputDir, "reference image.png"), Buffer.from(png1x1, "base64"));
  await writeFile(join(outputDir, "prior-output.webp"), Buffer.from(png1x1, "base64"));

  const refs = await prepareGrsaiReferenceImages({
    dataDir,
    ownerId,
    values: [
      "/files/input/reference%20image.png",
      "/files/output/prior-output.webp",
      "https://cdn.example.test/remote.png",
    ],
    limit: 3,
  });

  assert.equal(refs.length, 3);
  assert.match(refs[0], /^data:image\/png;base64,/);
  assert.match(refs[1], /^data:image\/webp;base64,/);
  assert.equal(refs[2], "https://cdn.example.test/remote.png");
  assert(!refs[0].includes("/api/provider-files/"), "local GRSAI input should be inlined, not signed");

  const capped = await prepareGrsaiReferenceImages({
    dataDir,
    ownerId,
    values: ["/files/input/reference%20image.png", "https://cdn.example.test/remote.png"],
    limit: 1,
  });
  assert.equal(capped.length, 1);
  assert.match(capped[0], /^data:image\/png;base64,/);

  console.log(JSON.stringify({ ok: true, checks: ["local references become data URLs", "remote references stay URLs", "limit is respected"] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
