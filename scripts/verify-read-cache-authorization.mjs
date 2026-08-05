import { readFile } from "node:fs/promises";

const web = await readFile("apps/web/src/services/runninghubCatalog.ts", "utf8");
const server = await readFile("apps/api/src/server.ts", "utf8");
const fail = (message) => { console.error(`FAIL ${message}`); process.exitCode = 1; };
if (!web.includes("if-none-match") || !web.includes("status === 304")) fail("RH client cache is not ETag-aware");
if (!server.includes("catalog.revision") || !server.includes("if-none-match")) fail("RH server cache is not revision-aware");
if (!server.includes("groupsByProvider")) fail("RH permission cache is not partitioned by provider/group");
if (process.exitCode) process.exit();
console.log("PASS read cache authorization contract");
