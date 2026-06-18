import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const source = await readFile(new URL("../scripts/db-migrate.mjs", import.meta.url), "utf8");

assert.match(source, /await import\("pg"\)|require\("pg"\)/);
assert.match(source, /@xinghuan\/api\/package\.json|apps", "api", "package\.json/);
assert.match(source, /PG_DRIVER_NOT_INSTALLED/);

console.log("PASS db migrate release deps contract");
