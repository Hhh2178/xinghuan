import assert from "node:assert/strict";
import { chmod, writeFile } from "node:fs/promises";

const baseUrl = loopbackUrl("XINGHUAN_PLAYWRIGHT_AUTH_BASE_URL");
const email = requiredEnvironment("XINGHUAN_PLAYWRIGHT_AUTH_EMAIL");
const password = requiredEnvironment("XINGHUAN_PLAYWRIGHT_AUTH_PASSWORD");
const outputPath = requiredEnvironment("XINGHUAN_PLAYWRIGHT_AUTH_OUTPUT");

assert.equal(process.env.XINGHUAN_ALLOW_ISOLATED_GRAY_TEST, "1", "ISOLATED_GRAY_TEST_NOT_EXPLICITLY_ENABLED");

const statusResponse = await fetch(new URL("/api/status", baseUrl));
const statusPayload = await statusResponse.json();
const status = statusPayload.data ?? statusPayload;
assert.equal(status.environment, "gray", `GRAY_CANDIDATE_REQUIRED:${status.environment || "unknown"}`);

const response = await fetch(new URL("/api/auth/login", baseUrl), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: baseUrl.origin,
    referer: `${baseUrl.origin}/`,
  },
  body: JSON.stringify({ email, password }),
});
assert.equal(response.ok, true, `AUTH_LOGIN_FAILED:${response.status}`);
const payload = await response.json();
assert.equal((payload.data ?? payload).authenticated, true, "AUTH_LOGIN_NOT_AUTHENTICATED");

const setCookies = typeof response.headers.getSetCookie === "function"
  ? response.headers.getSetCookie()
  : [response.headers.get("set-cookie")].filter(Boolean);
const cookies = setCookies.map((header) => parseCookie(header, baseUrl.hostname)).filter(Boolean);
assert(cookies.length > 0, "AUTH_SESSION_COOKIE_MISSING");

await writeFile(outputPath, JSON.stringify({ cookies, origins: [] }), { encoding: "utf8", mode: 0o600 });
await chmod(outputPath, 0o600);
console.log(JSON.stringify({ ok: true, environment: "gray", cookieCount: cookies.length }));

function parseCookie(header, domain) {
  const segments = String(header || "").split(";").map((item) => item.trim()).filter(Boolean);
  const separator = segments[0]?.indexOf("=") ?? -1;
  if (separator <= 0) return null;
  const attributes = new Set(segments.slice(1).map((item) => item.toLowerCase()));
  const sameSiteAttribute = [...attributes].find((item) => item.startsWith("samesite="));
  const sameSiteValue = sameSiteAttribute?.slice("samesite=".length);
  return {
    name: segments[0].slice(0, separator),
    value: segments[0].slice(separator + 1),
    domain,
    path: segments.find((item) => item.toLowerCase().startsWith("path="))?.slice(5) || "/",
    expires: -1,
    httpOnly: attributes.has("httponly"),
    secure: attributes.has("secure"),
    sameSite: sameSiteValue === "strict" ? "Strict" : sameSiteValue === "none" ? "None" : "Lax",
  };
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function loopbackUrl(name) {
  const url = new URL(requiredEnvironment(name));
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`${name}_LOOPBACK_REQUIRED`);
  return url;
}
