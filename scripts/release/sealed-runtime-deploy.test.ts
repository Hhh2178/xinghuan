import { createHash } from "node:crypto";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encryptReleaseArchive, releaseKeyFromValue, sha256 } from "../encrypt-release-archive.mjs";

describe("sealed runtime release commands", () => {
  let testDir: string;
  let archivePath: string;
  let sidecarPath: string;
  let sshKeyPath: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "xh-sealed-deploy-"));
    archivePath = join(testDir, "release.tar.gz");
    sidecarPath = `${archivePath}.sha256`;
    sshKeyPath = join(testDir, "test-key.pem");
    await writeFile(archivePath, "sealed archive fixture", "utf8");
    await writeFile(sshKeyPath, "test-only key fixture", "utf8");
  });

  afterEach(async () => {
    await unlink(sidecarPath).catch(() => undefined);
    await unlink(archivePath).catch(() => undefined);
    await unlink(sshKeyPath).catch(() => undefined);
    await rmdir(testDir).catch(() => undefined);
  });

  it("rejects a release when the archive digest disagrees with its adjacent sidecar", async () => {
    const actualDigest = createHash("sha256").update("sealed archive fixture").digest("hex");
    const wrongDigest = actualDigest.replace(/^./, actualDigest[0] === "0" ? "1" : "0");
    await writeFile(sidecarPath, `${wrongDigest}  ${basename(archivePath)}\n`, "utf8");

    const result = runNode([
      "scripts/release/deploy-gray-release.mjs",
      "--target-profile=old-server",
      "--env=gray",
      "--release=test-sealed-runtime",
      `--archive=${archivePath}`,
      `--ssh-key=${sshKeyPath}`,
      "--dry-run=true",
    ]);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("RELEASE_ARCHIVE_SHA256_MISMATCH");
  });

  it("shows the verified sidecar and production-only install in a credential-safe dry run", async () => {
    const digest = createHash("sha256").update("sealed archive fixture").digest("hex");
    await writeFile(sidecarPath, `${digest}  ${basename(archivePath)}\n`, "utf8");

    const result = runNode([
      "scripts/release/deploy-gray-release.mjs",
      "--target-profile=old-server",
      "--env=gray",
      "--release=test-sealed-runtime",
      `--archive=${archivePath}`,
      `--ssh-key=${sshKeyPath}`,
      "--dry-run=true",
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.sidecarPath).toBe(sidecarPath);
    expect(output.archiveSha256).toBe(digest);
    expect(output.remoteCommands).toContain("npm ci --omit=dev");
    expect(output.steps.map((step: { name: string }) => step.name)).toContain("upload-sidecar");
    expect(output.remoteCommands.indexOf(`set -a && . '${output.sharedEnvFile}' && set +a && npm run db:migrate`))
      .toBeLessThan(output.remoteCommands.findIndex((command: string) => command.startsWith("ln -sfn ")));
    expect(result.stdout).not.toContain(sshKeyPath);
    expect(result.stdout).not.toContain("test-only key fixture");
  });

  it("shows the compiled permission readiness entry in a credential-safe runtime dry run", () => {
    const result = runNode([
      "scripts/release/verify-gray-runtime.mjs",
      "--target-profile=old-server",
      "--env=gray",
      `--ssh-key=${sshKeyPath}`,
      "--expected-version=0.8.16",
      "--expected-environment=gray",
      "--expected-permission-ready=true",
      "--dry-run=true",
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.permissionReadinessCommand).toContain(
      "node apps/api/dist/cli/permission-readiness.js --expect-ready=true",
    );
    expect(output.permissionReadinessCommand).not.toContain("tsx");
    expect(result.stdout).not.toContain(sshKeyPath);
    expect(result.stdout).not.toContain("test-only key fixture");
  });

  it("adds the decrypt helper only for encrypted server archives", async () => {
    const encryptedPath = join(testDir, "release.tar.gz.enc");
    const encrypted = encryptReleaseArchive(Buffer.from("sealed archive fixture"), releaseKeyFromValue("release-test-key-that-is-long-enough-for-tests"));
    await writeFile(encryptedPath, encrypted);
    const encryptedSidecarPath = `${encryptedPath}.sha256`;
    await writeFile(encryptedSidecarPath, `${sha256(encrypted)}  ${basename(encryptedPath)}\n`, "utf8");

    const result = runNode([
      "scripts/release/deploy-gray-release.mjs",
      "--target-profile=new-server",
      "--env=gray",
      "--release=test-encrypted-runtime",
      `--archive=${encryptedPath}`,
      `--ssh-key=${sshKeyPath}`,
      "--dry-run=true",
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.encryptedArchive).toBe(true);
    expect(output.steps.map((step: { name: string }) => step.name)).toContain("upload-decrypt-helper");
    expect(output.remoteCommands.join("\n")).toContain("--decrypt");
    await unlink(encryptedSidecarPath);
    await unlink(encryptedPath);
  });
});

function runNode(args: string[]) {
  return spawnSync(process.execPath, args, {
    cwd: resolve(import.meta.dirname, "../.."),
    encoding: "utf8",
  });
}
