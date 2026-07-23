import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registryText = await read("apps/web/src/config/nodeRegistry.ts");
const canvasText = await read("apps/web/src/components/Canvas.tsx");
const portText = await read("apps/web/src/config/portTypes.ts");
const apiText = await read("apps/api/src/server.ts");
const externalProxyText = await read("apps/api/src/external-proxy.ts");
const providerFileAccessText = await read("apps/api/src/provider-file-access.ts");

const REQUIRED_INITIAL_DATA = {
  image: { label: "base image defaults", patterns: [/model:\s*'gpt-image-2'/, /aspectRatio:\s*'1:1'/, /referenceImages:\s*\[\]/] },
  edit: { label: "edit mode defaults", patterns: [/mode:\s*'edit'/, /model:\s*'gpt-image-2'/] },
  seedance: { label: "video generation defaults", patterns: [/duration:\s*5/, /ratio:\s*'16:9'/, /resolution:\s*'480p'/] },
  llm: { label: "chat defaults", patterns: [/temperature:\s*0\.7/, /maxTokens:\s*4096/, /history:\s*\[\]/] },
  audio: { label: "audio defaults", patterns: [/mode:\s*'generate'/, /version:\s*'v5\.5'/] },
  "multi-angle-3d": { label: "preset discriminator", patterns: [/preset:\s*'multi-angle-3d'/] },
  "panorama-720": { label: "preset discriminator", patterns: [/preset:\s*'panorama-720'/] },
  "penguin-portrait": { label: "preset discriminator", patterns: [/preset:\s*'penguin-portrait'/] },
  cinematic: { label: "toolbox discriminator", patterns: [/kind:\s*'cinematic'/] },
  "video-motion": { label: "toolbox discriminator", patterns: [/kind:\s*'video-motion'/] },
  "multi-angle-visual": { label: "toolbox discriminator", patterns: [/kind:\s*'multi-angle-visual'/] },
  "portrait-master": { label: "portrait defaults", patterns: [/portraitSelection:\s*\{\}/, /prompt:\s*''/] },
  "pose-master": { label: "pose defaults", patterns: [/kind:\s*'pose-master'/, /posePresetId:\s*'standing'/] },
  upload: { label: "upload placeholder default", patterns: [/uploadType:\s*null/] },
  "material-set": { label: "material set placeholder default", patterns: [/materialSetKind:\s*null/, /materialSetItems:\s*\[\]/] },
  "rh-tools": { label: "RH tools runtime defaults", patterns: [/rhToolsActiveCategoryId:\s*'all'/, /status:\s*'idle'/] },
  "rh-toolbox": { label: "RH toolbox runtime defaults", patterns: [/rhToolboxCategoryId:\s*'all'/, /status:\s*'idle'/] },
  "comfyui-store": { label: "ComfyUI runtime defaults", patterns: [/comfyuiStoreCategoryId:\s*'all'/, /status:\s*'idle'/] },
  "comfyui-app-maker": { label: "ComfyUI maker defaults", patterns: [/comfyMakerTitle:/, /comfyMakerWorkflowRaw:\s*''/] },
  loop: { label: "loop defaults", patterns: [/mode:\s*'serial'/, /kind:\s*'image'/] },
  "pick-from-set": { label: "pick defaults", patterns: [/pickKind:\s*'image'/, /pickIndex:\s*1/] },
  "smart-candidate-selector": { label: "governed selector defaults", patterns: [/selectorMediaKind:\s*'image'/, /selectorMode:\s*'manual'/, /selectorMaximum:\s*1/, /selectorLowConfidencePolicy:\s*'request_manual'/] },
  "image-compare": { label: "compare defaults", patterns: [/mode:\s*'slider'/, /split:\s*50/] },
  "drawing-board": { label: "drawing board defaults", patterns: [/boardRatio:\s*'16:9'/, /boardElements:\s*\[\]/] },
  "grid-crop": { label: "grid crop defaults", patterns: [/rows:\s*3/, /cols:\s*3/] },
  "grid-editor": { label: "grid editor defaults", patterns: [/gridEditorRows:\s*3/, /gridEditorLocalItems:\s*\[\]/] },
  "remove-ai-watermark": { label: "watermark defaults", patterns: [/aiWatermarkMode:\s*'smart'/, /aiWatermarkOptions:/] },
};

const CRITICAL_PROXY_NODE_TYPES = [
  "image",
  "video",
  "seedance",
  "llm",
  "runninghub",
  "runninghub-wallet",
  "rh-tools",
  "rh-toolbox",
  "comfyui-store",
];

const registryTypes = extractRegistryNodes(registryText);
const registryTypeSet = new Set(registryTypes.map((node) => node.type));
const duplicateTypes = registryTypes
  .map((node) => node.type)
  .filter((type, index, all) => all.indexOf(type) !== index);
const visibleNodes = registryTypes.filter((node) => !node.hidden && !node.devOnly);
const hiddenNodes = registryTypes.filter((node) => node.hidden);
const devOnlyNodes = registryTypes.filter((node) => node.devOnly);

const failures = [];
const checks = [];

check("NODE_REGISTRY has no duplicate node types", duplicateTypes.length === 0, duplicateTypes.join(", "));
check("NODE_REGISTRY is non-empty", registryTypes.length > 0, `count=${registryTypes.length}`);

for (const node of registryTypes) {
  checkNode(node, "component mapping", hasSpecificNodeMapping(canvasText, node.type));
  checkNode(node, "port declaration", hasPortDeclaration(portText, node.type));
}

check("groupBox has explicit component mapping", /nodeTypes\.groupBox\s*=\s*withNodeSerialBadge\(GroupBoxNode/.test(canvasText));
check("groupBox has explicit port declaration", hasPortDeclaration(portText, "groupBox"));
check("bulkPhantom has explicit component mapping", canvasText.includes("nodeTypes.bulkPhantom = BulkPhantomNode"));

for (const [type, requirement] of Object.entries(REQUIRED_INITIAL_DATA)) {
  check(`INITIAL_DATA.${type} contains ${requirement.label}`, hasInitialDataFor(type, requirement.patterns), requirement.label);
}

const executableTypes = extractSetValues(canvasText, "EXECUTABLE_NODE_TYPES");
for (const type of executableTypes) {
  const isInternal = type === "groupBox" || type === "bulkPhantom";
  check(`Executable node ${type} is registered or internal`, registryTypeSet.has(type) || isInternal);
  check(`Executable node ${type} has port declaration`, hasPortDeclaration(portText, type));
  check(`Executable node ${type} has component mapping`, isInternal || hasSpecificNodeMapping(canvasText, type));
}

for (const type of CRITICAL_PROXY_NODE_TYPES) {
  check(`Critical proxy node ${type} is registered`, registryTypeSet.has(type));
  check(`Critical proxy node ${type} has component mapping`, hasSpecificNodeMapping(canvasText, type));
  check(`Critical proxy node ${type} has port declaration`, hasPortDeclaration(portText, type));
}

check(
  "Image proxy signs local provider references",
  externalProxyHas("generateExternalImageProxy") &&
    externalProxyHas("normalizeProviderReferenceUrls(") &&
    providerFileAccessHas("providerFileAccessUrl("),
);
check(
  "Video proxy signs local provider references",
  externalProxyHas("generateExternalVideoProxy") &&
    externalProxyHas("normalizeProviderReferenceUrls(") &&
    externalProxyHas("normalizeProviderReferenceUrl(") &&
    providerFileAccessHas("providerFileAccessUrl("),
);
check(
  "LLM proxy signs local image references",
  externalProxyHas("generateExternalChatProxy") &&
    externalProxyHas("normalizeChatContentPart") &&
    externalProxyHas("normalizeProviderReferenceUrl(") &&
    providerFileAccessHas("providerFileAccessUrl("),
);
check("Provider files endpoint remains separate from ordinary /files auth", apiHas('"/api/provider-files/"') && apiHas("sendProviderFile"));

const summary = {
  totalRegistryNodes: registryTypes.length,
  visibleNodes: visibleNodes.length,
  hiddenNodes: hiddenNodes.length,
  devOnlyNodes: devOnlyNodes.length,
  executableNodes: executableTypes.length,
  categories: countBy(registryTypes, "category"),
};

console.log(JSON.stringify(summary, null, 2));
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail && !ok ? ` :: ${detail}` : ""}`);
}

if (failures.length > 0) {
  console.error(`\nNode acceptance matrix failed: ${failures.length} failing checks.`);
  process.exit(1);
}

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function check(name, ok, detail = "") {
  const passed = Boolean(ok);
  checks.push([name, passed, detail]);
  if (!passed) failures.push({ name, detail });
}

function checkNode(node, label, ok) {
  check(`Node ${node.type} (${node.label}) has ${label}`, ok, `${node.category}${node.hidden ? ", hidden" : ""}${node.devOnly ? ", devOnly" : ""}`);
}

function extractRegistryNodes(text) {
  const registryBlock = text.slice(text.indexOf("export const NODE_REGISTRY"));
  const nodes = [];
  const rowPattern = /\{\s*type:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'\s*,\s*category:\s*'([^']+)'[\s\S]*?\}/g;
  let match;
  while ((match = rowPattern.exec(registryBlock))) {
    const row = match[0];
    nodes.push({
      type: match[1],
      label: match[2],
      category: match[3],
      hidden: /hidden:\s*true/.test(row),
      devOnly: match.index < registryBlock.indexOf("export const NODE_GROUPS") && match[1] === "rh-toolbox-maker",
    });
  }
  return nodes;
}

function hasSpecificNodeMapping(text, type) {
  if (type === "rh-toolbox-maker") {
    return text.includes("'rh-toolbox-maker': RHToolboxMakerDevNode");
  }
  if (type === "group-execution-manager") {
    return /nodeTypes\[GROUP_EXECUTION_MANAGER_NODE_TYPE\]\s*=\s*withNodeSerialBadge\(GroupExecutionManagerNode/.test(text);
  }
  return hasObjectKey(text, "SPECIFIC_NODES", type);
}

function hasPortDeclaration(text, type) {
  if (type === "rh-toolbox-maker") {
    return text.includes("'rh-toolbox-maker': { inputs: [], outputs: ['text'] }");
  }
  return hasObjectKey(text, "NODE_PORTS", type);
}

function hasInitialDataFor(type, patterns) {
  const keyPattern = objectKeyPattern(type);
  const match = canvasText.match(new RegExp(`${keyPattern}\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m"));
  if (!match) return false;
  return patterns.every((pattern) => pattern.test(match[0]));
}

function hasObjectKey(text, objectName, key) {
  const start = text.indexOf(objectName);
  if (start < 0) return false;
  const block = text.slice(start, start + 9000);
  return new RegExp(`${objectKeyPattern(key)}\\s*:`).test(block);
}

function objectKeyPattern(key) {
  return key.includes("-") ? `'${escapeRegExp(key)}'` : `\\b${escapeRegExp(key)}`;
}

function extractSetValues(text, setName) {
  const match = text.match(new RegExp(`${setName}\\s*=\\s*new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function apiHas(value) {
  return apiText.includes(value);
}

function externalProxyHas(value) {
  return externalProxyText.includes(value);
}

function providerFileAccessHas(value) {
  return providerFileAccessText.includes(value);
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
