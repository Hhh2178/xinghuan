import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function blockFor(source, selector) {
  const pattern = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\n\\}`, "gm");
  const matches = [...source.matchAll(pattern)].map((match) => match[1]);
  assert.ok(matches.length > 0, `missing CSS block for ${selector}`);
  return selector === ".provider-rail"
    ? matches.find((block) => block.includes("position: sticky")) || matches.at(-1)
    : matches.at(-1);
}

async function run() {
  const css = await readFile(new URL("../apps/admin/src/styles.css", import.meta.url), "utf8");
  const panel = await readFile(new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url), "utf8");
  const rail = blockFor(css, ".provider-rail");
  const list = blockFor(css, ".provider-list");
  const footer = blockFor(css, ".provider-rail-footer");
  const footerAction = blockFor(css, ".provider-rail-footer .ghost-action");

  assert.match(rail, /display:\s*grid;/, "provider rail should use explicit title/list/footer grid rows");
  assert.match(rail, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/, "provider rail should reserve a fixed footer row");
  assert.match(rail, /overflow:\s*hidden;/, "provider rail itself should not scroll");
  assert.doesNotMatch(rail, /overflow-y:\s*auto;/, "provider rail must not own the scrolling");

  assert.match(list, /min-height:\s*0;/, "provider list should be allowed to shrink inside the rail");
  assert.match(list, /overflow-y:\s*auto;/, "provider list should own vertical scrolling");

  assert.match(footer, /border-top:/, "provider footer should be visually separated from the scrolling list");
  assert.match(footer, /background:/, "provider footer should cover list content behind it");
  assert.match(footerAction, /width:\s*100%;/, "add provider action should span the rail footer");

  assert.ok(panel.includes('className="provider-rail-footer"'), "add provider action should live in a dedicated fixed footer wrapper");
  const listIndex = panel.indexOf('className="provider-list"');
  const footerIndex = panel.indexOf('className="provider-rail-footer"');
  const addActionIndex = panel.indexOf('<Plus aria-hidden="true" /> 新增平台');
  assert.ok(listIndex > -1 && footerIndex > -1 && addActionIndex > -1, "provider list, footer, and add action should all render");
  assert.ok(listIndex < footerIndex && footerIndex < addActionIndex, "add provider action should render after the scrolling list inside a fixed footer");
  assert.doesNotMatch(panel, /<em>\{provider\.protocol/, "compact Provider rail must not render protocol badges");
  assert.doesNotMatch(css, /\.provider-item em\s*\{/, "protocol badge styles must not occupy Provider rail width");
  assert.match(blockFor(css, ".provider-item"), /grid-template-columns:\s*36px minmax\(0,\s*1fr\);/, "Provider rail must reserve its width for icon and readable service identity");
  assert.match(panel, /title=\{provider\.name\}/, "full Provider name must remain available when visual truncation is required");

  const scrollbarSelectors = css.slice(0, css.indexOf(".admin-shell"));
  assert.ok(scrollbarSelectors.includes(".provider-list"), "provider list should receive custom scrollbar styling");
  assert.ok(!scrollbarSelectors.includes(".provider-rail,"), "provider rail should not be in global scrollbar selector list");

  console.log("PASS admin provider rail keeps add action fixed below the scrollable list");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
