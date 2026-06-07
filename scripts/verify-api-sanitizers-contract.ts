import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  inferMime,
  safeEmail,
  safeFilename,
  safeJsonText,
  safeSlug,
  safeText,
  safeUserId,
} from "../apps/api/src/api-sanitizers.js";

const root = process.cwd();
const modulePath = join(root, "apps", "api", "src", "api-sanitizers.ts");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

const longText = `  ${"星".repeat(300)}  `;

const checks = [
  {
    name: "api sanitizers helper module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "server imports api sanitizers helpers",
    pass: serverSource.includes('from "./api-sanitizers.js"'),
  },
  {
    name: "server does not inline api sanitizers",
    pass:
      !/function\s+safeText\s*\(/.test(serverSource) &&
      !/function\s+safeEmail\s*\(/.test(serverSource) &&
      !/function\s+safeSlug\s*\(/.test(serverSource) &&
      !/function\s+safeJsonText\s*\(/.test(serverSource) &&
      !/function\s+safeFilename\s*\(/.test(serverSource) &&
      !/function\s+safeUserId\s*\(/.test(serverSource) &&
      !/function\s+inferMime\s*\(/.test(serverSource),
  },
  {
    name: "safeText trims values and caps length",
    pass: safeText(longText).length === 240 && safeText(null, "fallback") === "fallback",
  },
  {
    name: "safeEmail validates and normalizes email",
    pass: safeEmail("  USER@Example.COM ") === "user@example.com" && safeEmail("bad-email") === "",
  },
  {
    name: "safeSlug normalizes ids and preserves current dash-only behavior",
    pass: safeSlug(" Hello 世界 !! __A ", "item") === "hello-__a" && safeSlug("!!!", "item") === "-",
  },
  {
    name: "safeJsonText keeps valid json and falls back on invalid json",
    pass:
      safeJsonText(" {\"ok\": true} ") === "{\"ok\": true}" &&
      safeJsonText("{bad", "{\"fallback\":true}") === "{\"fallback\":true}",
  },
  {
    name: "safeFilename removes path and reserved filename characters",
    pass:
      safeFilename("../bad name?.png", "file") === "bad_name_.png" &&
      safeFilename("", "file") === "file",
  },
  {
    name: "safeUserId strips path traversal characters and caps length",
    pass:
      safeUserId("../usr admin!*") === "___usr_admin__" &&
      safeUserId("x".repeat(120)).length === 80 &&
      safeUserId("") === "user",
  },
  {
    name: "inferMime maps web, image, video, audio and binary fallbacks",
    pass:
      inferMime("index.html") === "text/html; charset=utf-8" &&
      inferMime("bundle.mjs") === "text/javascript; charset=utf-8" &&
      inferMime("style.css") === "text/css; charset=utf-8" &&
      inferMime("image.webp") === "image/webp" &&
      inferMime("clip.webm") === "video/webm" &&
      inferMime("track.mid") === "audio/midi" &&
      inferMime("font.woff2") === "font/woff2" &&
      inferMime("unknown.bin") === "application/octet-stream",
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("API sanitizers contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
