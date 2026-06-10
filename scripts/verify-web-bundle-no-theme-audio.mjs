import { readdir } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = new URL("../apps/web/dist/assets/", import.meta.url);
const entries = await readdir(assetsDir);
const audioAssets = entries.filter((name) => /\.(mp3|mid|midi|wav|ogg)$/i.test(name));

if (audioAssets.length > 0) {
  console.error(`FAIL theme audio assets still present in web bundle: ${audioAssets.join(", ")}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  assetsDir: join(assetsDir.pathname),
  checked: entries.length,
  audioAssets,
}, null, 2));
