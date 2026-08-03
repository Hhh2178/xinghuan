# Sealed Production Release Artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a production archive that runs the existing API, Worker, Web and Admin without shipping project source code, tests, design documents or source maps.

**Architecture:** Keep the current TypeScript/Vite development builds unchanged, add an esbuild-based production runtime build that bundles internal server code, and make the release packager copy only an explicit allowlist into a temporary staging directory. Runtime verification uses a compiled permission-readiness CLI, while the archive contract rejects every forbidden source or documentation path before deployment.

**Tech Stack:** Node.js ESM, TypeScript 5.9, esbuild, Vite 8, npm workspaces, tar, SHA-256, Vitest, PowerShell/Linux shell deployment scripts.

## Global Constraints

- Baseline version is `0.8.15`; this work becomes Gray `0.8.16` and Production reuses the exact Gray archive.
- API and Worker runtime bundles use `bundle=true`, `minify=true`, `sourcemap=false`, `platform=node`, `format=esm`.
- External runtime packages are exactly `busboy`, `pg`, `redis`, and `sharp`; all `@xinghuan/*` code is bundled.
- Production archive must not contain `src`, `.ts`, `.tsx`, `.map`, tests, fixtures, `docs`, `CONTEXT.md`, `AGENTS.md`, `MEMORY.md`, `DEVLOG.md`, `.git`, runtime data, logs, uploads, outputs, `.env`, keys, tokens or database URLs.
- Remote install uses `npm ci --omit=dev`.
- PC visual smoke is `1920x1080` only.
- Do not touch the existing unrelated July logbook changes.
- If the unrelated July logbook changes are still uncommitted at release time, stop before `verify:release-worktree-clean` and ask the user to resolve them; do not stash, reset, commit or delete them as part of this plan.

---

## File Map

- Create `scripts/build-production-runtime.mjs`: builds bundled API/Worker entries into a caller-provided staging root.
- Create `apps/api/src/permissions/permission-database-state.ts`: owns database-state loading used by readiness checks.
- Create `apps/api/src/permissions/permission-database-state.test.ts`: tests database row normalization and target protection.
- Create `apps/api/src/cli/permission-readiness.ts`: compiled runtime readiness entrypoint.
- Modify `scripts/verify-permission-readiness.ts`: reuse the new API-owned state reader for local development.
- Rewrite `scripts/package-release.mjs`: explicit runtime allowlist, production bundle integration, build manifest, archive and SHA sidecar.
- Rewrite `scripts/verify-release-package-contract.mjs`: inspect archive contents instead of requiring source.
- Modify `scripts/verify-release-version-alignment.mjs`: accept bundled API markers and verify `BUILD-MANIFEST.json`.
- Modify `scripts/release/deploy-gray-release.mjs`: verify sidecar and install production dependencies only.
- Modify `scripts/release/verify-gray-runtime.mjs`: execute compiled readiness CLI rather than `tsx`.
- Modify `package.json`: add `build:production-runtime` and production package contract commands; add esbuild as a dev dependency.
- Modify `package-lock.json`: lock esbuild and its platform package.
- Create `scripts/build-production-runtime.test.ts`: tests build outputs and absence of internal imports/source maps.
- Create `scripts/package-release.test.ts`: tests allowlist, manifest and forbidden archive entries.
- Create `docs/adr/0006-dual-track-release-artifacts.md`: record the accepted dual-artifact decision.
- Modify `docs/adr/README.md`: index ADR 0006.
- Modify `docs/systems/observability-and-ops/release-gates.md`: document sealed artifact gates.
- Modify `docs/systems/observability-and-ops/gray-and-production-operations.md`: document same-archive promotion and sidecar verification.
- Modify `ops/gray-deploy-runbook.md` and `ops/production-deploy-runbook.md`: replace source-dependent remote commands.

### Task 0: Register the sealed-artifact harness before implementation

**Files:**
- Create: `scripts/verify-sealed-production-artifact-harness.mjs`
- Modify: `package.json`
- Modify: `docs/systems/harness/README.md`
- Modify: `docs/systems/harness/workspace-verify-release-map.md`
- Modify: `docs/systems/harness/subharness-convention.md`

**Interfaces:**
- Produces root command `npm run verify:sealed-production-artifact-harness`.
- Verifies that the release harness exposes the sealed artifact contract, that the harness map names the dual-artifact boundary, and that the staged release order is recorded before any package is built.

- [ ] **Step 1: Write the failing harness contract**

Assert that `package.json` exposes `verify:sealed-production-artifact-harness`, that `harness:verify:release` invokes it, and that the three harness documents mention `0.8.16` sealed artifact, `0.8.17` admin tiers, `0.8.18` RunningHub groups, plus the “same Gray archive promoted to Production” rule.

- [ ] **Step 2: Run the contract and verify the missing-entry failure**

Run: `node scripts/verify-sealed-production-artifact-harness.mjs`

Expected: FAIL because the script, package entry and documentation entries do not exist yet.

- [ ] **Step 3: Implement the contract and documentation map**

Add the script, register it in `package.json` and the release harness chain, and update the three harness documents. Keep the documents as an execution map; do not duplicate the feature design. State that each implementation task must append its actual verify/build/runtime evidence before the corresponding release is called complete.

- [ ] **Step 4: Run the focused contract**

Run: `npm run verify:sealed-production-artifact-harness && npm run verify:harness-doc-sync-contract`

Expected: PASS with no secrets or runtime data written to the repository.

- [ ] **Step 5: Commit the harness registration**

```bash
git add package.json scripts/verify-sealed-production-artifact-harness.mjs docs/systems/harness/README.md docs/systems/harness/workspace-verify-release-map.md docs/systems/harness/subharness-convention.md
git commit -m "chore: register sealed artifact harness"
```

The remaining tasks must preserve this harness entry and append their actual results to the same maps.

### Task 1: Add the production runtime bundle builder

**Files:**
- Create: `scripts/build-production-runtime.mjs`
- Create: `scripts/build-production-runtime.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: CLI argument `--out=.tmp/production-runtime` in the documented local command.
- Produces: `buildProductionRuntime({ outDir }): Promise<{ apiEntry: string; workerEntry: string }>` and files `.tmp/production-runtime/apps/api/dist/server.js`, `.tmp/production-runtime/apps/worker/dist/worker.js` for that command.

- [ ] **Step 1: Write the failing bundle contract test**

```ts
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionRuntime } from "./build-production-runtime.mjs";

describe("production runtime bundle", () => {
  it("bundles internal packages without source maps", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "xh-runtime-test-"));
    const result = await buildProductionRuntime({ outDir });
    await expect(stat(result.apiEntry)).resolves.toBeTruthy();
    await expect(stat(result.workerEntry)).resolves.toBeTruthy();
    const api = await readFile(result.apiEntry, "utf8");
    const worker = await readFile(result.workerEntry, "utf8");
    expect(api).not.toMatch(/from\s+["']@xinghuan\//);
    expect(worker).not.toMatch(/from\s+["']@xinghuan\//);
    expect(api).not.toContain("sourceMappingURL=");
    expect(worker).not.toContain("sourceMappingURL=");
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx vitest run scripts/build-production-runtime.test.ts`

Expected: FAIL because `scripts/build-production-runtime.mjs` does not exist.

- [ ] **Step 3: Add esbuild and the exact build configuration**

Add `esbuild` to root `devDependencies`, update the lockfile with `npm install --package-lock-only`, and implement:

```js
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const external = ["busboy", "pg", "redis", "sharp"];

export async function buildProductionRuntime({ outDir }) {
  const targetRoot = resolve(rootDir, outDir);
  const apiEntry = resolve(targetRoot, "apps/api/dist/server.js");
  const workerEntry = resolve(targetRoot, "apps/worker/dist/worker.js");
  await mkdir(dirname(apiEntry), { recursive: true });
  await mkdir(dirname(workerEntry), { recursive: true });
  const common = {
    bundle: true,
    minify: true,
    sourcemap: false,
    platform: "node",
    format: "esm",
    target: "node22",
    external,
    legalComments: "none",
    treeShaking: true,
  };
  await build({ ...common, entryPoints: [resolve(rootDir, "apps/api/src/server.ts")], outfile: apiEntry });
  await build({ ...common, entryPoints: [resolve(rootDir, "apps/worker/src/worker.ts")], outfile: workerEntry });
  return { apiEntry, workerEntry };
}
```

The CLI path must call `buildProductionRuntime({ outDir: argument("out") })` and reject an empty `--out`.

- [ ] **Step 4: Add and run the root command**

Add:

```json
"build:production-runtime": "node scripts/build-production-runtime.mjs --out=.tmp/production-runtime"
```

Run: `npx vitest run scripts/build-production-runtime.test.ts && npm run build:production-runtime`

Expected: PASS; `.tmp/production-runtime/apps/api/dist/server.js` and Worker entry exist, with no `.map` siblings.

- [ ] **Step 5: Commit the isolated builder**

```bash
git add package.json package-lock.json scripts/build-production-runtime.mjs scripts/build-production-runtime.test.ts
git commit -m "build: add sealed server runtime bundles"
```

### Task 2: Compile permission readiness into the runtime

**Files:**
- Create: `apps/api/src/permissions/permission-database-state.ts`
- Create: `apps/api/src/permissions/permission-database-state.test.ts`
- Create: `apps/api/src/cli/permission-readiness.ts`
- Modify: `scripts/verify-permission-readiness.ts`
- Modify: `scripts/build-production-runtime.mjs` and `scripts/build-production-runtime.test.ts` to include the compiled readiness CLI in the production runtime output.

**Interfaces:**
- Produces: `connectPermissionDatabase(): Promise<{ client: Client; currentDatabase: string }>` and `readPermissionDatabaseState(client): Promise<PermissionDatabaseState>`.
- Produces runtime CLI: `node apps/api/dist/cli/permission-readiness.js --expect-ready=true`.

- [ ] **Step 1: Move the database reader behind a tested API module**

Write tests with a fake `query` function that returns subjects, rules, groups, users and legacy policies. Assert that admin users remain `role: "admin"`, missing group IDs become `undefined`, and an expected database `xinghuan_expected` with actual database `xinghuan_wrong` closes the client and throws `DATABASE_TARGET_MISMATCH:xinghuan_wrong`.

- [ ] **Step 2: Run the focused test before implementation**

Run: `npx vitest run apps/api/src/permissions/permission-database-state.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Extract the existing implementation without changing semantics**

Move the exported interfaces and functions currently in `scripts/permission-db-state.ts` into the new API module. Keep SQL, normalization and expected-database protection byte-for-byte equivalent. Change the local script to import from:

```ts
import {
  connectPermissionDatabase,
  readPermissionDatabaseState,
} from "../apps/api/src/permissions/permission-database-state.js";
```

- [ ] **Step 4: Add the compiled CLI**

Implement the CLI with the existing output contract:

```ts
const expectedReady = argument("expect-ready", "true") !== "false";
const { client, currentDatabase } = await connectPermissionDatabase();
try {
  const report = evaluatePermissionReadiness(await readPermissionDatabaseState(client));
  const output = {
    ok: report.ready === expectedReady,
    database: currentDatabase,
    expectedReady,
    ready: report.ready,
    mode: String(process.env.XINGHUAN_PERMISSION_MODE || "legacy"),
    metrics: report.metrics,
    failures: report.failures.map(({ code, message, count }) => ({ code, message, count })),
  };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 5: Build and verify the compiled entry**

Run: `npm run build -w @xinghuan/api && npm run build:production-runtime`

Expected: the existing `apps/api/tsconfig.build.json` includes every file below `src`, so normal API dist contains `apps/api/dist/cli/permission-readiness.js` without a tsconfig change; the documented production build also creates `.tmp/production-runtime/apps/api/dist/cli/permission-readiness.js`.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run apps/api/src/permissions/permission-database-state.test.ts apps/api/src/permissions/permission-readiness.test.ts`

```bash
git add apps/api/src/permissions/permission-database-state.ts apps/api/src/permissions/permission-database-state.test.ts apps/api/src/cli/permission-readiness.ts scripts/verify-permission-readiness.ts scripts/build-production-runtime.mjs
git commit -m "refactor: compile permission readiness for production"
```

### Task 3: Replace the release archive with an allowlist packager

**Files:**
- Rewrite: `scripts/package-release.mjs`
- Create: `scripts/package-release.test.ts`

**Interfaces:**
- Consumes: release name positional argument.
- Produces: `dist-release/20260803-sealed-artifact-local-v0816.tar.gz` and `dist-release/20260803-sealed-artifact-local-v0816.tar.gz.sha256` for the documented local proof.
- Archive produces: `BUILD-MANIFEST.json` with stable relative paths and content hashes.

- [ ] **Step 1: Write failing archive inventory tests**

The test must call the exported `validateArchiveEntries(entries)` with both safe and unsafe paths and assert rejection of:

```ts
const forbidden = [
  "apps/api/src/server.ts",
  "apps/web/src/App.tsx",
  "docs/adr/0004-workflow-scoped-deterministic-supervision.md",
  "AGENTS.md",
  "apps/api/dist/server.js.map",
  ".git/config",
  "apps/api/data/auth/auth.json",
  ".env",
];
```

Also assert that `apps/api/dist/server.js`, `apps/worker/dist/worker.js`, `apps/api/db/047_administrator_tier.sql`, Web/Admin dist assets and `BUILD-MANIFEST.json` are accepted.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run scripts/package-release.test.ts`

Expected: FAIL because validation exports do not exist.

- [ ] **Step 3: Define the production allowlist**

The packager must copy only these classes of paths:

```js
const runtimeFiles = [
  "package.json",
  "package-lock.json",
  "scripts/start-single-port.mjs",
  "scripts/db-migrate.mjs",
  "apps/api/db",
  "apps/web/dist",
  "apps/admin/dist",
  "config/environments.json",
  "config/release-target-profiles.json",
  "ops/systemd",
  "ops/nginx",
];

const workspaceManifests = [
  "apps/admin/package.json",
  "apps/api/package.json",
  "apps/comfyui-connector/package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/agent-core/package.json",
  "packages/canvas-core/package.json",
  "packages/model-core/package.json",
  "packages/shared/package.json",
  "packages/ui/package.json",
];
```

Copy the production bundle outputs into the existing API/Worker dist paths after the static allowlist. Do not copy internal package dist directories.

- [ ] **Step 4: Generate manifest and sidecar**

For every staged regular file, calculate SHA-256 and sort entries by path. Write:

```ts
interface BuildManifest {
  schemaVersion: 1;
  version: string;
  sourceCommit: string;
  builtAt: string;
  artifactType: "production-runtime";
  sourceMaps: false;
  entries: Array<{ path: string; sizeBytes: number; sha256: string }>;
  contentManifestSha256: string;
}
```

The `entries` array is calculated before `BUILD-MANIFEST.json` is added and therefore excludes the manifest itself. `contentManifestSha256` is the SHA-256 of the canonical UTF-8 JSON encoding of `entries`.

After tar creation, calculate the archive SHA-256 and write one line such as `64-lowercase-hex-digest  20260803-sealed-artifact-local-v0816.tar.gz` to the sidecar. Never put the archive hash back inside the archive.

- [ ] **Step 5: Validate the real archive**

Run:

```bash
npm run build:single-port
npm run package:release -- 20260803-sealed-artifact-local-v0816
tar -tzf dist-release/20260803-sealed-artifact-local-v0816.tar.gz
```

Expected: the archive contains runtime entries only; the SHA sidecar exists; no forbidden path or extension is present.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run scripts/package-release.test.ts scripts/build-production-runtime.test.ts`

```bash
git add scripts/package-release.mjs scripts/package-release.test.ts
git commit -m "build: package runtime-only release archives"
```

### Task 4: Make release contracts verify the sealed archive

**Files:**
- Rewrite: `scripts/verify-release-package-contract.mjs`
- Modify: `scripts/verify-release-version-alignment.mjs`
- Modify: `scripts/package-release.mjs` to invoke the archive and version-alignment contracts after tar creation.
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run verify:release-package-contract` for source-level configuration and `node scripts/verify-release-package-contract.mjs --archive=dist-release/20260803-sealed-artifact-local-v0816.tar.gz` for archive-level enforcement.

- [ ] **Step 1: Replace source-required assertions with forbidden inventory assertions**

The contract must assert:

- packager invokes `buildProductionRuntime`;
- packager uses an explicit allowlist;
- forbidden patterns are exported and tested;
- archive contains API, Worker, Web, Admin, migrations, start/migrate scripts, package files and `BUILD-MANIFEST.json`;
- archive has no source, docs, maps, tests, data or secrets.

- [ ] **Step 2: Update version alignment**

Read `BUILD-MANIFEST.json` from the archive and compare `version` to root `package.json`. Continue checking the API status version marker, but accept the minified bundle marker generated by esbuild. Fail with `RELEASE_VERSION_MISMATCH` on any disagreement.

- [ ] **Step 3: Add the archive contract to packaging**

After tar creation, invoke:

```js
await runNodeScript(["scripts/verify-release-package-contract.mjs", `--archive=${archivePath}`]);
await runNodeScript(["scripts/verify-release-version-alignment.mjs", `--archive=${archivePath}`]);
```

- [ ] **Step 4: Run release harness and commit**

Run:

```bash
npm run verify:release-package-contract
npm run harness:verify:release
```

```bash
git add scripts/verify-release-package-contract.mjs scripts/verify-release-version-alignment.mjs package.json
git commit -m "test: enforce sealed release archive contract"
```

### Task 5: Cut deployment and runtime verification off from source tools

**Files:**
- Modify: `scripts/release/deploy-gray-release.mjs`
- Modify: `scripts/release/verify-gray-runtime.mjs`
- Test: existing release contract scripts plus new archive test.

**Interfaces:**
- Deploy consumes both archive and adjacent `.sha256` sidecar.
- Runtime verify executes `node apps/api/dist/cli/permission-readiness.js --expect-ready=true` for the enforced Gray/Production checks.

- [ ] **Step 1: Verify the local archive before upload**

Parse the sidecar, calculate local SHA-256, and reject a mismatch with `RELEASE_ARCHIVE_SHA256_MISMATCH`. Add the sidecar to dry-run output without printing credentials.

- [ ] **Step 2: Change remote installation**

Replace remote `npm ci` with:

```sh
npm ci --omit=dev
```

Keep migration before symlink switch. Do not change shared env/data paths.

- [ ] **Step 3: Change permission readiness verification**

Replace:

```sh
npx --no-install tsx scripts/verify-permission-readiness.ts
```

with:

```sh
node apps/api/dist/cli/permission-readiness.js
```

- [ ] **Step 4: Exercise dry-run output and contracts**

Run:

```bash
node scripts/release/deploy-gray-release.mjs --target-profile=old-server --env=gray --release=20260803-sealed-artifact-local-v0816 --archive=dist-release/20260803-sealed-artifact-local-v0816.tar.gz --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --dry-run=true
node scripts/release/verify-gray-runtime.mjs --target-profile=old-server --env=gray --ssh-key=D:/codex/服务器/Tencent_Cloud_Server.pem --expected-version=0.8.16 --expected-environment=gray --dry-run=true
```

Expected: dry-run prints `npm ci --omit=dev` and compiled CLI path; it does not print key contents or environment secrets.

- [ ] **Step 5: Commit deployment cutover**

```bash
git add scripts/release/deploy-gray-release.mjs scripts/release/verify-gray-runtime.mjs
git commit -m "deploy: run sealed artifacts without source tooling"
```

### Task 6: Document and locally prove the production artifact

**Files:**
- Create: `docs/adr/0006-dual-track-release-artifacts.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/systems/observability-and-ops/release-gates.md`
- Modify: `docs/systems/observability-and-ops/gray-and-production-operations.md`
- Modify: `ops/gray-deploy-runbook.md`
- Modify: `ops/production-deploy-runbook.md`
- Modify: `docs/systems/harness/README.md`
- Modify: `docs/systems/harness/workspace-verify-release-map.md`

**Interfaces:**
- Produces operator instructions that use only runtime files on servers.

- [ ] **Step 1: Record the ADR**

ADR 0006 must state: development/source artifact remains internal; deployment artifact is runtime-only; frontend code cannot be absolutely hidden; server root access remains outside the secrecy boundary; same Gray archive is promoted to Production.

- [ ] **Step 2: Update runbooks with exact commands**

Document package, sidecar, deploy and verify commands. Remove instructions that require running source-dependent `tsx` scripts inside the server release directory.

- [ ] **Step 3: Run the full local proof**

Run:

```bash
npm run type-check
npm run build:single-port
npm run verify:release-package-contract
npm run package:release -- 20260803-sealed-artifact-local-v0816
npm run harness:verify:project
npm run harness:verify:workspace
npm run harness:verify:release
```

Extract the archive into a new temporary directory, run `npm ci --omit=dev`, execute `node scripts/db-migrate.mjs` against an isolated test database, start API and Worker with test ports, and verify `/api/status` returns `0.8.16`.

- [ ] **Step 4: Commit docs and proof contracts**

```bash
git add docs/adr/0006-dual-track-release-artifacts.md docs/adr/README.md docs/systems/observability-and-ops/release-gates.md docs/systems/observability-and-ops/gray-and-production-operations.md ops/gray-deploy-runbook.md ops/production-deploy-runbook.md
git commit -m "docs: define sealed artifact release operations"
```

### Task 7: Release `0.8.16` through Gray and Production

**Files:**
- Modify: root and workspace version manifests required by the existing version alignment contract.
- Modify: `ops/current/release-state.json`, generated Gray/Production projections, current release index, release and validation logbooks.

**Interfaces:**
- Produces immutable Gray archive and SHA sidecar; Production consumes the same pair.

- [ ] **Step 1: Bump only PATCH to `0.8.16` and run preflight**

Change the root `package.json` version from `0.8.15` to `0.8.16`, update the root package record and lockfile version fields in `package-lock.json` with `npm install --package-lock-only`, and do not rewrite the independent workspace package versions. Then run:

```bash
npm install --package-lock-only
npm run verify:release-worktree-clean
npm run verify:quick
```

- [ ] **Step 2: Prepare and deploy Gray**

Use release ID `20260803-sealed-production-artifact-v0816-r1`. Run the standard prepare, deploy and runtime verify commands with the authorized old-server target profile and existing credential path. Verify archive SHA before upload.

- [ ] **Step 3: Perform authenticated Gray acceptance**

Verify API/Worker active, migrations applied, permission readiness ready, Admin/Web load at `1920x1080`, one non-billed login/read flow, and rollback symlink target remains valid. Scan the installed release directory and confirm the same forbidden inventory is absent remotely.

- [ ] **Step 4: Promote the exact archive to Production only after Gray approval**

Use the same archive path and SHA sidecar. Do not rebuild. Verify Production version/environment, services, permission readiness and authenticated pages.

- [ ] **Step 5: Update canonical state and commit release evidence**

Update `ops/current/release-state.json` first, generate human-readable projections, add release/validation records for both environments, run staged release contracts, and commit with:

```bash
git commit -m "release: deploy sealed runtime artifact v0.8.16"
```
