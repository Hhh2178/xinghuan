import { mkdtemp, readFile, rmdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decryptReleaseArchive, releaseKeyFromValue, encryptedReleaseMagic } from "./encrypt-release-archive.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const archive = argument("archive");
if (!archive) {
  const source = await readFile(resolve(rootDir, "scripts/encrypt-release-archive.mjs"), "utf8");
  const packageJson = JSON.parse(await readFile(resolve(rootDir, "package.json"), "utf8"));
  if (!source.includes("aes-256-gcm") || packageJson.scripts?.["package:server-release"] !== "node scripts/package-server-release.mjs") {
    throw new Error("ENCRYPTED_RELEASE_SOURCE_CONTRACT_FAILED");
  }
  console.log(JSON.stringify({ ok: true, mode: "source" }, null, 2));
  process.exit(0);
}

const key = releaseKeyFromValue();
const encrypted = await readFile(archive);
if (!encrypted.subarray(0, encryptedReleaseMagic.length).equals(encryptedReleaseMagic)) {
  throw new Error("ENCRYPTED_RELEASE_MAGIC_MISSING");
}
const staging = await mkdtemp(join(tmpdir(), "xinghuan-encrypted-release-"));
const plain = join(staging, `${basename(archive)}.tar.gz`);
try {
  await writeFile(plain, decryptReleaseArchive(encrypted, key), { mode: 0o600 });
  await runNode(resolve(rootDir, "scripts/verify-release-package-contract.mjs"), [`--archive=${plain}`]);
  console.log(JSON.stringify({ ok: true, mode: "archive", archive, encryptedBytes: encrypted.byteLength }, null, 2));
} finally {
  await rm(plain, { force: true });
  await rmdir(staging).catch(() => undefined);
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) || "";
}

function runNode(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [command, ...args], { cwd: rootDir, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`VERIFY_ENCRYPTED_RELEASE_FAILED:${code}`)));
  });
}
