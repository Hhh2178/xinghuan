import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export const encryptedReleaseMagic = Buffer.from("XHENC1", "ascii");
export const encryptedReleaseVersion = 1;
const ivLength = 12;
const authTagLength = 16;

export function releaseKeyFromValue(value = process.env.XINGHUAN_RELEASE_ENCRYPTION_KEY) {
  const source = String(value || "").trim();
  if (source.length < 32) {
    throw new Error("RELEASE_ENCRYPTION_KEY_REQUIRED");
  }
  return createHash("sha256").update(source, "utf8").digest();
}

export function encryptReleaseArchive(input, key) {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([
    encryptedReleaseMagic,
    Buffer.from([encryptedReleaseVersion]),
    iv,
    authTag,
    ciphertext,
  ]);
}

export function decryptReleaseArchive(input, key) {
  const headerLength = encryptedReleaseMagic.length + 1 + ivLength + authTagLength;
  if (input.length < headerLength || !input.subarray(0, encryptedReleaseMagic.length).equals(encryptedReleaseMagic)) {
    throw new Error("RELEASE_ENCRYPTED_ARCHIVE_HEADER_INVALID");
  }
  const versionOffset = encryptedReleaseMagic.length;
  if (input[versionOffset] !== encryptedReleaseVersion) {
    throw new Error("RELEASE_ENCRYPTED_ARCHIVE_VERSION_UNSUPPORTED");
  }
  const ivOffset = versionOffset + 1;
  const tagOffset = ivOffset + ivLength;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    input.subarray(ivOffset, tagOffset),
  );
  decipher.setAuthTag(input.subarray(tagOffset, tagOffset + authTagLength));
  return Buffer.concat([
    decipher.update(input.subarray(headerLength)),
    decipher.final(),
  ]);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const args = parseArgs(process.argv.slice(2));
if (args.input && args.output) {
  const key = releaseKeyFromValue();
  const input = await readFile(args.input);
  const output = args.decrypt
    ? decryptReleaseArchive(input, key)
    : encryptReleaseArchive(input, key);
  await writeFile(args.output, output, { mode: 0o600 });
  console.log(JSON.stringify({
    ok: true,
    mode: args.decrypt ? "decrypt" : "encrypt",
    input: args.input,
    output: args.output,
    inputSha256: sha256(input),
    outputSha256: sha256(output),
    bytes: output.byteLength,
  }, null, 2));
}

function parseArgs(argv) {
  const result = {};
  for (const item of argv) {
    if (item === "--decrypt") {
      result.decrypt = true;
      continue;
    }
    if (!item.startsWith("--") || !item.includes("=")) continue;
    const [key, ...rest] = item.slice(2).split("=");
    result[key] = rest.join("=");
  }
  return result;
}
