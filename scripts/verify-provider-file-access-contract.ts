import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseLocalProviderFileReference,
  parseProviderFileAccessRequest,
  providerFileAccessUrl,
  safeUserId,
} from "../apps/api/src/provider-file-access.js";

const root = process.cwd();
const modulePath = join(root, "apps", "api", "src", "provider-file-access.ts");
const serverPath = join(root, "apps", "api", "src", "server.ts");
const serverSource = readFileSync(serverPath, "utf8");

const secret = Buffer.alloc(32, 7);
const now = 1_780_000_000_000;
const origin = "https://canvas.example.test";
const user = { id: "usr-admin/../bad", email: "admin@example.test", name: "Admin", role: "admin" };
const normalizedUserId = safeUserId(user.id);
const signedUrl = providerFileAccessUrl("/files/input/reference image.png", user, origin, {
  secret,
  now,
  ttlMs: 1_000,
});
const parsedUrl = new URL(signedUrl);
const parsed = parseProviderFileAccessRequest(parsedUrl, { secret, now });
const expired = parseProviderFileAccessRequest(parsedUrl, { secret, now: now + 2_000 });
parsedUrl.searchParams.set("sig", "0".repeat(64));
const tampered = parseProviderFileAccessRequest(parsedUrl, { secret, now });

const checks = [
  {
    name: "provider file access helper module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "server imports provider file access helpers",
    pass: serverSource.includes('from "./provider-file-access.js"'),
  },
  {
    name: "server does not inline provider HMAC signing",
    pass: !/function\s+signProviderFile\s*\(/.test(serverSource) && !/function\s+verifyProviderFileSignature\s*\(/.test(serverSource),
  },
  {
    name: "provider file access normalizes unsafe user ids",
    pass: normalizedUserId === "usr-admin____bad",
  },
  {
    name: "local input references become signed provider URLs",
    pass:
      signedUrl.startsWith(`${origin}/api/provider-files/${normalizedUserId}/input/`) &&
      signedUrl.includes("exp=") &&
      signedUrl.includes("sig="),
  },
  {
    name: "provider file request parses signed URL",
    pass:
      parsed.ok === true &&
      parsed.userId === normalizedUserId &&
      parsed.bucket === "input" &&
      parsed.filename === "reference image.png",
  },
  {
    name: "provider file request rejects expired URL",
    pass: expired.ok === false && expired.error === "PROVIDER_FILE_EXPIRED",
  },
  {
    name: "provider file request rejects tampered signature",
    pass: tampered.ok === false && tampered.error === "PROVIDER_FILE_SIGNATURE_INVALID",
  },
  {
    name: "provider file parser strips path traversal filename",
    pass: parseLocalProviderFileReference("/files/output/../secret.png")?.filename === "secret.png",
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Provider file access contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
