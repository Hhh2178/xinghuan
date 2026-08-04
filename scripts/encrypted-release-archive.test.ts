import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptReleaseArchive,
  encryptReleaseArchive,
  releaseKeyFromValue,
} from "./encrypt-release-archive.mjs";

describe("encrypted server release archive", () => {
  const key = releaseKeyFromValue("release-test-key-that-is-long-enough-for-tests");

  it("round-trips the sealed archive payload", () => {
    const payload = Buffer.from("sealed production runtime", "utf8");
    const encrypted = encryptReleaseArchive(payload, key);
    expect(decryptReleaseArchive(encrypted, key)).toEqual(payload);
  });

  it("rejects tampering", () => {
    const encrypted = encryptReleaseArchive(Buffer.from("payload"), key);
    encrypted[encrypted.length - 1] ^= 1;
    expect(() => decryptReleaseArchive(encrypted, key)).toThrow();
  });

  it("never uses the plaintext archive digest as the encrypted output digest", () => {
    const payload = Buffer.from("payload");
    const encrypted = encryptReleaseArchive(payload, key);
    expect(createHash("sha256").update(encrypted).digest("hex"))
      .not.toBe(createHash("sha256").update(payload).digest("hex"));
  });
});
