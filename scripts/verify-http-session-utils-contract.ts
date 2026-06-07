import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { IncomingMessage } from "node:http";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  buildSessionCookie,
  expireSessionCookie,
  isSecureRequest,
  readCookie,
  readJsonBody,
} from "../apps/api/src/http-session-utils.js";

const root = process.cwd();
const modulePath = join(root, "apps", "api", "src", "http-session-utils.ts");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

function requestWithHeaders(headers: Record<string, string>): IncomingMessage {
  return { headers } as IncomingMessage;
}

function requestWithBody(chunks: Array<string | Buffer>): IncomingMessage {
  return {
    headers: {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as IncomingMessage;
}

const jsonBody = await readJsonBody<{ name: string; count: number }>(
  requestWithBody(["  {\"name\":\"xinghuan\",", Buffer.from("\"count\":2}")]),
);
const emptyBody = await readJsonBody(requestWithBody(["  ", Buffer.from("")]));

const insecureRequest = requestWithHeaders({
  cookie: "theme=dark; xh_session=abc%3D123; token=tail%20value",
  host: "canvas.example.test",
});
const secureRequest = requestWithHeaders({
  "x-forwarded-proto": "https",
  cookie: "xh_session=secure%20id",
});

const checks = [
  {
    name: "http session helper module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "server imports http session helpers",
    pass: serverSource.includes('from "./http-session-utils.js"'),
  },
  {
    name: "server does not inline http session helpers",
    pass:
      !/async\s+function\s+readJsonBody\s*</.test(serverSource) &&
      !/function\s+readCookie\s*\(/.test(serverSource) &&
      !/function\s+buildSessionCookie\s*\(/.test(serverSource) &&
      !/function\s+expireSessionCookie\s*\(/.test(serverSource) &&
      !/function\s+isSecureRequest\s*\(/.test(serverSource),
  },
  {
    name: "reads trimmed json request bodies",
    pass: jsonBody.name === "xinghuan" && jsonBody.count === 2,
  },
  {
    name: "empty request body becomes empty object",
    pass: emptyBody && typeof emptyBody === "object" && Object.keys(emptyBody as Record<string, unknown>).length === 0,
  },
  {
    name: "reads url encoded cookies and preserves equals signs",
    pass: readCookie(insecureRequest, SESSION_COOKIE_NAME) === "abc=123" && readCookie(insecureRequest, "token") === "tail value",
  },
  {
    name: "missing cookies return empty string",
    pass: readCookie(insecureRequest, "missing") === "",
  },
  {
    name: "secure request is detected from forwarded proto",
    pass: isSecureRequest(secureRequest) && !isSecureRequest(insecureRequest),
  },
  {
    name: "session cookie uses encoded value, ttl, httponly, samesite and secure flag",
    pass:
      SESSION_TTL_MS === 7 * 24 * 60 * 60 * 1000 &&
      buildSessionCookie(secureRequest, "secure id") ===
        "xh_session=secure%20id; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure",
  },
  {
    name: "expired session cookie clears value and preserves secure flag",
    pass: expireSessionCookie(secureRequest) === "xh_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("HTTP session utils contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
