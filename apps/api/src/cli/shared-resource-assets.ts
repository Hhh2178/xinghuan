import { resolve } from "node:path";

import { materializeSharedResourceAssets } from "../shared-resource-asset-migration.js";

const dataDir = resolve(argument("data-dir") || process.env.XINGHUAN_DATA_DIR || "apps/api/data");
const apply = argument("apply") === "true";
const expectReady = argument("expect-ready", "true") !== "false";
const report = await materializeSharedResourceAssets({ dataDir, apply });

console.log(JSON.stringify(report, null, 2));
if (expectReady && !report.readyForMigration) process.exitCode = 1;

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}
