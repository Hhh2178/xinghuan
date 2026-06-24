import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const node = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNode.tsx", import.meta.url), "utf8");
const configSection = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNodeConfigSection.tsx", import.meta.url), "utf8");
const paramSection = await readFile(new URL("../apps/web/src/components/nodes/RunningHubNodeParamSection.tsx", import.meta.url), "utf8");

assert.match(node, /from '\.\/RunningHubNodeConfigSection'/, "RunningHubNode should import extracted config section");
assert.match(node, /from '\.\/RunningHubNodeParamSection'/, "RunningHubNode should import extracted param section");
assert.match(node, /<RunningHubNodeConfigSection/, "RunningHubNode should delegate config rendering to extracted section");
assert.match(node, /<RunningHubNodeParamSection/, "RunningHubNode should delegate parameter rendering to extracted section");
assert.doesNotMatch(node, /<MaterialPreviewSection/, "RunningHubNode should not render MaterialPreviewSection inline after section split");
assert.doesNotMatch(node, /<MentionPromptInput/, "RunningHubNode should not render MentionPromptInput inline after section split");
assert.match(configSection, /export default function RunningHubNodeConfigSection\(/, "config section should export extracted component");
assert.match(paramSection, /export default function RunningHubNodeParamSection\(/, "param section should export extracted component");
assert.match(paramSection, /from '\.\/MentionPromptInput'/, "param section should own mention prompt input rendering");

console.log("PASS runninghub node section split contract");
