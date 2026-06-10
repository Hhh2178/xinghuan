import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractChatContent,
  extractImageOutputs,
  extractVideoUrls,
  looksLikeBase64Image,
  toImageDataUrl,
} from "../apps/api/src/provider-response-parser.js";

const root = process.cwd();
const modulePath = join(root, "apps", "api", "src", "provider-response-parser.ts");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

const base64Png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==";
const dataUrl = `data:image/png;base64,${base64Png}`;

const imageRaw = {
  data: [
    { url: "https://cdn.example.com/a.png" },
    { b64_json: base64Png },
  ],
  result: {
    imageUrl: "https://cdn.example.com/a.png",
    image_base64: dataUrl,
  },
};

const apimartAsyncImageRaw = {
  code: 200,
  data: {
    status: "completed",
    result: {
      images: [
        {
          url: [
            "https://cdn.example.com/apimart-result.png",
          ],
        },
      ],
    },
  },
};

const videoRaw = {
  data: [
    { url: "https://cdn.example.com/a.mp4?download=1" },
    { output: [{ videoUrl: "https://cdn.example.com/b.webm" }] },
  ],
  result: {
    outputUrl: "https://cdn.example.com/a.mp4?download=1",
    nested: "https://cdn.example.com/not-a-video.png",
  },
};

const imageOutputs = extractImageOutputs(imageRaw);
const apimartImageOutputs = extractImageOutputs(apimartAsyncImageRaw);
const videoUrls = extractVideoUrls(videoRaw);

const checks = [
  {
    name: "provider response parser helper module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "server imports provider response parser helpers",
    pass: serverSource.includes('from "./provider-response-parser.js"'),
  },
  {
    name: "server does not inline provider response extractors",
    pass:
      !/function\s+extractImageOutputs\s*\(/.test(serverSource) &&
      !/function\s+extractVideoUrls\s*\(/.test(serverSource) &&
      !/function\s+extractChatContent\s*\(/.test(serverSource),
  },
  {
    name: "extracts chat content from OpenAI message",
    pass: extractChatContent({ choices: [{ message: { content: "hello" } }] }) === "hello",
  },
  {
    name: "extracts chat content from text and array parts",
    pass:
      extractChatContent({ choices: [{ text: "legacy text" }] }) === "legacy text" &&
      extractChatContent({ content: ["a", { text: "b" }, { content: "c" }, { nope: "x" }] }) === "a\nb\nc",
  },
  {
    name: "extracts and deduplicates image urls and base64",
    pass:
      imageOutputs.urls.length === 1 &&
      imageOutputs.urls[0] === "https://cdn.example.com/a.png" &&
      imageOutputs.base64.length === 2 &&
      imageOutputs.base64.includes(base64Png) &&
      imageOutputs.base64.includes(dataUrl),
  },
  {
    name: "extracts nested APIMart async image urls",
    pass:
      apimartImageOutputs.urls.length === 1 &&
      apimartImageOutputs.urls[0] === "https://cdn.example.com/apimart-result.png",
  },
  {
    name: "extracts and deduplicates video urls only",
    pass:
      videoUrls.length === 2 &&
      videoUrls.includes("https://cdn.example.com/a.mp4?download=1") &&
      videoUrls.includes("https://cdn.example.com/b.webm") &&
      !videoUrls.some((url) => url.includes("not-a-video")),
  },
  {
    name: "detects base64 image payloads conservatively",
    pass: looksLikeBase64Image(base64Png) && !looksLikeBase64Image("short-not-base64"),
  },
  {
    name: "converts raw base64 to png data url",
    pass: toImageDataUrl(base64Png) === dataUrl && toImageDataUrl(dataUrl) === dataUrl,
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Provider response parser contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
