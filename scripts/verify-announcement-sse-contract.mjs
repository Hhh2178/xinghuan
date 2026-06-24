import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const sse = await readFile(new URL("../apps/api/src/announcement-sse.ts", import.meta.url), "utf8");
const webHook = await readFile(new URL("../apps/web/src/hooks/useAnnouncements.ts", import.meta.url), "utf8");

assert.match(sse, /announcement\.published/);
assert.match(sse, /announcement\.updated/);
assert.match(webHook, /markAnnouncementRead/);
assert.match(webHook, /strongReminder/);

console.log("PASS announcement SSE contract");
