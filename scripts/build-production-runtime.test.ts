import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildProductionRuntime,
  parseProductionRuntimeOutDir,
} from "./build-production-runtime.mjs";

describe("production runtime bundle", () => {
  it.each([undefined, "", "   "])("rejects an empty output argument (%s)", (value) => {
    expect(() => parseProductionRuntimeOutDir(value)).toThrow("PRODUCTION_RUNTIME_OUT_REQUIRED");
  });

  it("bundles internal packages without source maps", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "xh-runtime-test-"));
    const result = await buildProductionRuntime({ outDir });

    await expect(stat(result.apiEntry)).resolves.toBeTruthy();
    await expect(stat(result.workerEntry)).resolves.toBeTruthy();
    await expect(stat(result.permissionReadinessEntry)).resolves.toBeTruthy();

    const api = await readFile(result.apiEntry, "utf8");
    const worker = await readFile(result.workerEntry, "utf8");
    const permissionReadiness = await readFile(result.permissionReadinessEntry, "utf8");
    expect(api).not.toMatch(/from\s+["']@xinghuan\//);
    expect(worker).not.toMatch(/from\s+["']@xinghuan\//);
    expect(permissionReadiness).not.toMatch(/from\s+["']@xinghuan\//);
    expect(api).not.toContain("sourceMappingURL=");
    expect(worker).not.toContain("sourceMappingURL=");
    expect(permissionReadiness).not.toContain("sourceMappingURL=");
  });
});
