import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/web/src/components/nodes/UploadNode.tsx", import.meta.url), "utf8");

assert.match(source, /inferUploadKindFromData/, "upload node should infer upload kind from saved material fields");
assert.match(source, /const uploadType: UploadKind \| null = inferUploadKindFromData\(d\)/, "upload node should not depend only on saved uploadType");
assert.match(source, /if \(uploadType === null && inferredUploadKind\)/, "upload node should restore inferred uploadType back into node data");

console.log("PASS upload node material persistence contract");
