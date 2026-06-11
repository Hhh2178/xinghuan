import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "apps/web/src/components/nodes/ImageNode.tsx",
  "apps/web/src/components/nodes/VideoNode.tsx",
  "apps/web/src/components/nodes/LLMNode.tsx",
];

const forbidden = [
  "本地 T8 内置模型",
  "参数来源：当前发布模型",
  "当前模型的尺寸会随比例自动匹配",
];

async function run() {
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    for (const text of forbidden) {
      assert.equal(
        source.includes(text),
        false,
        `${file} should not expose reserved implementation copy: ${text}`,
      );
    }
  }

  const outputNode = await readFile(
    new URL("../apps/web/src/components/nodes/OutputNode.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(outputNode.includes("keepAspectRatio={false}"), "OutputNode should resize freely");
  assert.ok(outputNode.includes("maxWidth={980}"), "OutputNode should cap horizontal growth");
  assert.ok(outputNode.includes("overflow: 'visible'"), "OutputNode should not hide media footers behind an internal scrollbar");

  console.log("PASS generation node UI copy is clean and output node resizes predictably");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
