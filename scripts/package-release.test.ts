import { describe, expect, it } from "vitest";
import { validateArchiveEntries } from "./package-release.mjs";

describe("sealed production release inventory", () => {
  it("accepts only production runtime entries", () => {
    expect(() =>
      validateArchiveEntries([
        "package.json",
        "package-lock.json",
        "scripts/start-single-port.mjs",
        "scripts/db-migrate.mjs",
        "apps/api/dist/server.js",
        "apps/api/dist/cli/permission-readiness.js",
        "apps/worker/dist/worker.js",
        "apps/api/db/047_administrator_tier.sql",
        "apps/web/dist/assets/app.js",
        "apps/admin/dist/index.html",
        "config/environments.json",
        "config/release-target-profiles.json",
        "ops/systemd/xinghuan-canvas.service",
        "ops/nginx/xinghuan-canvas.conf",
        "apps/admin/package.json",
        "packages/shared/package.json",
        "BUILD-MANIFEST.json",
      ]),
    ).not.toThrow();
  });

  it.each([
    "apps/api/src/server.ts",
    "apps/web/src/App.tsx",
    "docs/adr/0004-workflow-scoped-deterministic-supervision.md",
    "AGENTS.md",
    "apps/api/dist/server.js.map",
    ".git/config",
    "apps/api/data/auth/auth.json",
    ".env",
  ])("rejects forbidden entry %s", (entry) => {
    expect(() => validateArchiveEntries([entry])).toThrow(
      `RELEASE_ARCHIVE_FORBIDDEN_ENTRY:${entry}`,
    );
  });
});
