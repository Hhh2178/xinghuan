import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageScriptPath = resolve(rootDir, "scripts/package-release.mjs");
const source = await readFile(packageScriptPath, "utf8");

assertArrayIncludes("requiredPaths", "scripts/prune-old-output-materials.mjs");
assertArrayIncludes("includedPaths", "scripts/prune-old-output-materials.mjs");

console.log(
  JSON.stringify(
    {
      ok: true,
      verifiedFile: packageScriptPath,
      requiredScript: "scripts/prune-old-output-materials.mjs",
    },
    null,
    2,
  ),
);

function assertArrayIncludes(arrayName, expectedItem) {
  const block = readArrayBlock(arrayName);
  if (!block.includes(`"${expectedItem}"`)) {
    throw new Error(`${arrayName} missing ${expectedItem}`);
  }
}

function readArrayBlock(arrayName) {
  const pattern = new RegExp(`const ${arrayName} = \\[(.*?)\\];`, "s");
  const match = source.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Unable to locate ${arrayName} in package-release.mjs`);
  }
  return match[1];
}
