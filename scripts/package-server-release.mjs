import { unlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageRelease } from "./package-release.mjs";
import {
  encryptReleaseArchive,
  releaseKeyFromValue,
  sha256,
} from "./encrypt-release-archive.mjs";
import { readFile, writeFile } from "node:fs/promises";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseName = String(process.argv[2] || "").trim();
if (!releaseName) throw new Error("MISSING_RELEASE_NAME");

const key = releaseKeyFromValue();
const plain = await packageRelease({ releaseName });
const plaintext = await readFile(plain.archive);
const encryptedPath = `${plain.archive}.enc`;
const encrypted = encryptReleaseArchive(plaintext, key);
await writeFile(encryptedPath, encrypted, { mode: 0o600 });
await writeFile(
  `${encryptedPath}.sha256`,
  `${sha256(encrypted)}  ${basename(encryptedPath)}\n`,
  { mode: 0o600 },
);

await unlink(plain.archive);
await unlink(`${plain.archive}.sha256`);

console.log(JSON.stringify({
  ok: true,
  artifactType: "encrypted-production-runtime",
  archive: encryptedPath,
  sidecar: `${encryptedPath}.sha256`,
  encryptedSha256: sha256(encrypted),
  plaintextArchiveSha256: sha256(plaintext),
  bytes: encrypted.byteLength,
}, null, 2));
