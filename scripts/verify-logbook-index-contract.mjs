import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const datePart = (type) => dateParts.find((part) => part.type === type)?.value || "";
const year = datePart("year");
const month = `${year}-${datePart("month")}`;
const date = `${month}-${datePart("day")}`;
const monthDir = resolve(root, "docs/logbooks/daily", year, month);
for (const name of ["README.md", "recent-highlights.md", `${date}.md`]) {
  await access(resolve(monthDir, name));
}
const highlights = await readFile(resolve(monthDir, "recent-highlights.md"), "utf8");
if (!highlights.includes("package.json") || !highlights.includes("release-state.json")) {
  throw new Error("recent-highlights must point to canonical state files");
}
const logbooks = await readFile(resolve(root, "docs/logbooks/README.md"), "utf8");
if (!logbooks.includes(`${month}/recent-highlights.md`) || !logbooks.includes("verify:logbook-index-contract")) {
  throw new Error("docs/logbooks/README.md is missing current index contract");
}
console.log(JSON.stringify({ ok: true, month, date, requiredFiles: 3 }, null, 2));
