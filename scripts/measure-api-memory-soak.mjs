import { writeFile } from "node:fs/promises";

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || ""];
}));
const baseUrl = String(args.get("base-url") || process.env.XINGHUAN_GRAY_BASE_URL || "").replace(/\/$/, "");
const durationMs = Math.max(10_000, Number(args.get("duration-ms") || 60_000));
const intervalMs = Math.max(1_000, Number(args.get("interval-ms") || 5_000));
const output = String(args.get("output") || "output/performance/memory-soak.json");
if (!baseUrl) throw new Error("--base-url is required");
const samples = [];
const startedAt = Date.now();
while (Date.now() - startedAt < durationMs) {
  const response = await fetch(`${baseUrl}/api/status`, { headers: { accept: "application/json", "x-read-performance": "1" } });
  const body = await response.json().catch(() => ({}));
  samples.push({ at: Date.now(), status: response.status, version: body?.data?.version || body?.version || "", environment: body?.data?.environment || body?.environment || "" });
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sampleCount: samples.length, samples }, null, 2));
console.log(JSON.stringify({ output, sampleCount: samples.length, durationMs: Date.now() - startedAt }));
