import { readFile } from "node:fs/promises";

const server = await readFile("apps/api/src/server.ts", "utf8");
const fail = (message) => { console.error(`FAIL ${message}`); process.exitCode = 1; };
const canvasList = server.match(/if \(url\.pathname === "\/api\/canvas"\)[\s\S]*?if \(request\.method === "POST"\)/);
if (canvasList?.[0]?.includes("discoverOrphanCanvasSnapshots")) fail("canvas list route performs snapshot recovery");
const rhCatalog = server.match(/if \(url\.pathname === "\/api\/runninghub\/catalog"[\s\S]*?return;\n    }/);
if (rhCatalog?.[0]?.includes("reconcilePermissionSubjects")) fail("RH catalog GET performs permission reconciliation");
if (process.exitCode) process.exit();
console.log("PASS read path side-effect contract");
