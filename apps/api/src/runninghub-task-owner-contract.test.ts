import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("RunningHub legacy task ownership snapshot", () => {
  it("persists the submitting user in both payload and result", async () => {
    const serverSource = await readFile(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
    const routeStart = serverSource.indexOf('url.pathname === "/api/proxy/runninghub/task"');
    const routeEnd = serverSource.indexOf("const runningHubTaskMatch", routeStart);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);

    const routeSource = serverSource.slice(routeStart, routeEnd);
    expect(routeSource.match(/userId:\s*currentUser!\.id/g)).toHaveLength(2);
    expect(routeSource).toMatch(/const payload:[\s\S]*?userId:\s*currentUser!\.id/);
    expect(routeSource).toMatch(/result:\s*\{[\s\S]*?userId:\s*currentUser!\.id/);
  });
});
