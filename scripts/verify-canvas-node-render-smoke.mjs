import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const root = new URL("../", import.meta.url);
const baseUrl = (process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200").replace(/\/+$/, "");
const sameOriginHeaders = {
  origin: baseUrl,
  referer: `${baseUrl}/`,
};
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? process.env.XINGHUAN_BOOTSTRAP_ADMIN_PASSWORD ?? "admin123456";
const chromePath = process.env.CHROME_PATH || findChromePath();
const nodeRegistryText = await readFile(new URL("apps/web/src/config/nodeRegistry.ts", root), "utf8");
const registryNodes = extractRegistryNodes(nodeRegistryText);
const expectedNodes = registryNodes.map((node, index) => ({
  id: `smoke-${node.type}`,
  type: node.type,
  label: node.label,
  hidden: node.hidden,
  index,
}));

if (!chromePath) {
  console.error("Chrome executable was not found. Set CHROME_PATH to enable browser render smoke verification.");
  process.exit(1);
}

if (expectedNodes.length === 0) {
  console.error("NODE_REGISTRY extraction returned no nodes.");
  process.exit(1);
}

let cookie = "";
let createdCanvasId = "";
let chrome = null;
let cdp = null;

async function main() {
try {
  await login();
  const canvas = await fetchJson("/api/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `Node render smoke ${new Date().toISOString()}` }),
  });
  createdCanvasId = canvas.data?.id || "";
  assert(createdCanvasId, "canvas was not created");

  const canvasData = buildCanvasData(expectedNodes);
  await fetchJson(`/api/canvas/${encodeURIComponent(createdCanvasId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(canvasData),
  });

  const port = await freePort();
  const userDataDir = await mkdtemp(join(tmpdir(), "xinghuan-cdp-profile-"));
  chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });

  await waitForChrome(port);
  const pageWsUrl = await createChromePage(port);
  cdp = new CdpConnection(pageWsUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await setSessionCookie(cdp, baseUrl, cookie);

  const loaded = cdp.waitForEvent("Page.loadEventFired", () => true, 60000);
  await cdp.send("Page.navigate", { url: baseUrl });
  await loaded;

  const renderResult = await waitForCanvasRender(cdp, expectedNodes);
  const runtimeErrors = cdp.runtimeErrors();
  const networkFailures = cdp.networkFailures();
  const assetResponses = cdp.assetResponses();
  const missing = renderResult.missingIds || [];
  const classMismatches = renderResult.classMismatches || [];
  const legacyFound = renderResult.legacyFound || [];

  console.log(JSON.stringify({
    ok: missing.length === 0 && classMismatches.length === 0 && legacyFound.length === 0 && runtimeErrors.length === 0 && !renderResult.loginVisible && !renderResult.errorBoundaryVisible,
    expectedNodeCount: expectedNodes.length,
    renderedNodeCount: renderResult.renderedNodeCount,
    visibleNodeCount: renderResult.visibleNodeCount,
    hiddenRegistryNodeCount: expectedNodes.filter((node) => node.hidden).length,
    canvasId: createdCanvasId,
    missingIds: missing,
    classMismatches,
    legacyFound,
    loginVisible: renderResult.loginVisible,
    errorBoundaryVisible: renderResult.errorBoundaryVisible,
    runtimeErrors,
    networkFailures,
    assetResponses,
  }, null, 2));

  assert(missing.length === 0, `missing rendered nodes: ${missing.join(", ")}`);
  assert(classMismatches.length === 0, `node type class mismatches: ${classMismatches.join(", ")}`);
  assert(legacyFound.length === 0, `legacy empty-state text found: ${legacyFound.join(", ")}`);
  assert(!renderResult.loginVisible, "login screen is still visible after setting authenticated session");
  assert(!renderResult.errorBoundaryVisible, "canvas error boundary is visible");
  assert(runtimeErrors.length === 0, `browser runtime errors: ${runtimeErrors.join(" | ")}`);

  console.log("PASS browser canvas renders every registered node");
} finally {
  if (createdCanvasId && cookie) {
    await fetchText(`/api/canvas/${encodeURIComponent(createdCanvasId)}`, { method: "DELETE" }).catch(() => undefined);
  }
  cdp?.close();
  if (chrome && !chrome.killed) chrome.kill();
}
}

async function login() {
  const result = await fetchJson("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  assert(result.data?.authenticated === true, "login failed");
}

function buildCanvasData(nodes) {
  const cols = 6;
  const gapX = 430;
  const gapY = 520;
  return {
    nodes: nodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: {
        x: (index % cols) * gapX,
        y: Math.floor(index / cols) * gapY,
      },
      data: initialDataFor(node.type, node.label, index + 1),
    })),
    edges: [],
    viewport: { x: 60, y: 40, zoom: 0.55 },
    nextNodeSerialId: nodes.length + 1,
  };
}

function initialDataFor(type, label, serialId) {
  const base = {
    label,
    nodeSerialId: serialId,
    prompt: "",
    text: "",
    outputText: "",
    status: "idle",
  };
  const byType = {
    image: { model: "gpt-image-2", aspectRatio: "1:1", sizeLevel: "1K", referenceImages: [] },
    edit: { mode: "edit", model: "gpt-image-2", aspectRatio: "1:1", sizeLevel: "1K", referenceImages: [] },
    video: { model: "veo-3.1", ratio: "16:9", duration: 5, resolution: "720p" },
    seedance: { model: "doubao-seedance-2-0-fast-260128", duration: 5, ratio: "16:9", resolution: "480p" },
    audio: { mode: "generate", version: "v5.5", title: "", tags: "", seed: 0, continueAt: 28 },
    llm: { model: "gemini-3.1-flash-lite-preview", temperature: 0.7, maxTokens: 4096, stream: true, history: [] },
    upload: { uploadType: null, fileName: "" },
    output: { directOutputText: "Render smoke output", directTextSegments: ["Render smoke output"] },
    "material-set": { materialSetKind: null, materialSetItems: [] },
    "rh-tools": { rhToolsActiveCategoryId: "all", rhToolsActiveAppId: "", rhToolsSearchQuery: "", appInfo: null, paramValues: {}, materialOrder: [], urls: [] },
    "rh-toolbox": { rhToolboxCategoryId: "all", rhToolboxActiveToolId: "", rhToolboxSearchQuery: "", rhToolboxUserParams: {}, materialOrder: [], urls: [] },
    "comfyui-store": { comfyuiStoreProviderId: "", comfyuiStoreCategoryId: "all", comfyuiStoreActiveAppId: "", comfyuiStoreSearchQuery: "", comfyuiStoreParamValues: {}, materialOrder: [] },
    "comfyui-app-maker": { comfyMakerTitle: "Anima text to image", comfyMakerAppId: "anima-text-to-image-v1", comfyMakerCategoryId: "image", comfyMakerWorkflowRaw: "" },
    "multi-angle-3d": { preset: "multi-angle-3d" },
    "panorama-720": { preset: "panorama-720" },
    "penguin-portrait": { preset: "penguin-portrait" },
    cinematic: { kind: "cinematic", cinematicLanguage: "en", cinematicStrength: "balanced" },
    "video-motion": { kind: "video-motion", motionLanguage: "en" },
    "multi-angle-visual": { kind: "multi-angle-visual", multiAngleLanguage: "en", multiAnglePromptMode: "qwen" },
    "portrait-master": { portraitLanguage: "en", portraitSelection: {}, portraitLocks: {}, portraitWeights: {}, portraitCustomText: "" },
    "pose-master": { kind: "pose-master", poseLanguage: "en", posePresetId: "standing", poseViewId: "front", poseShotId: "full-body", poseIntensityId: "natural" },
    loop: { mode: "serial", kind: "image", outputs: [], progress: { done: 0, total: 0, ok: 0, fail: 0 } },
    "pick-from-set": { pickKind: "image", pickIndex: 1 },
    "image-compare": { mode: "slider", align: "contain", split: 50, opacity: 50, threshold: 24 },
    "drawing-board": { boardRatio: "16:9", boardWidth: 960, boardHeight: 540, boardElements: [], boardColor: "#111827", boardStrokeSize: 5 },
    "grid-crop": { rows: 3, cols: 3, gap: 0 },
    "grid-editor": { gridEditorRows: 3, gridEditorCols: 3, gridEditorWidth: 1200, gridEditorHeight: 1200, gridEditorGap: 0, gridEditorLocalItems: [], gridEditorHiddenIds: [] },
    "remove-ai-watermark": { aiWatermarkMode: "smart", aiWatermarkProcessAll: false, aiWatermarkOptions: { mark: "auto", detect: true, inpaint: true } },
    "text-split": { sourceText: "", splitMode: "line", delimiter: "---", chunkSize: 600, textSegments: [], segments: [] },
  };
  return { ...base, ...(byType[type] || {}) };
}

async function waitForCanvasRender(connection, nodes) {
  const expression = `(() => new Promise((resolve) => {
    const expected = ${JSON.stringify(nodes.map(({ id, type }) => ({ id, type })))};
    const legacyPhrases = ["贞贞的无限画布", "企鹅共创版", "请先在左侧创建或选择"];
    const startedAt = Date.now();
    const read = () => {
      const nodeEls = Array.from(document.querySelectorAll(".react-flow__node"));
      const rendered = nodeEls.map((el) => ({
        id: el.getAttribute("data-id") || "",
        className: String(el.className || ""),
        visible: Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }));
      const ids = new Set(rendered.map((item) => item.id).filter(Boolean));
      const classesById = new Map(rendered.map((item) => [item.id, item.className]));
      const bodyText = document.body ? document.body.textContent || "" : "";
      return {
        renderedNodeCount: rendered.length,
        visibleNodeCount: rendered.filter((item) => item.visible).length,
        missingIds: expected.filter((item) => !ids.has(item.id)).map((item) => item.id),
        classMismatches: expected
          .filter((item) => ids.has(item.id) && !String(classesById.get(item.id) || "").includes("react-flow__node-" + item.type))
          .map((item) => item.id + ":" + item.type),
        legacyFound: legacyPhrases.filter((phrase) => bodyText.includes(phrase)),
        loginVisible: bodyText.includes("安全工作区登录") && bodyText.includes("进入工作区"),
        errorBoundaryVisible: bodyText.includes("画布渲染出错了，已被错误边界捕获"),
      };
    };
    const timer = setInterval(() => {
      const state = read();
      if (state.missingIds.length === 0 || Date.now() - startedAt > 45000) {
        clearInterval(timer);
        resolve(state);
      }
    }, 250);
  }))()`;
  const response = await connection.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, 60000);
  return response.result?.value || {};
}

async function setSessionCookie(connection, origin, cookieText) {
  const [name, ...rest] = cookieText.split("=");
  const value = rest.join("=");
  assert(name && value, "missing session cookie");
  const result = await connection.send("Network.setCookie", {
    name,
    value,
    url: origin,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  assert(result.success === true, "failed to set browser session cookie");
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}

async function fetchText(pathname, options) {
  const response = await fetch(toUrl(pathname), withCookie(options));
  captureCookie(response);
  return { status: response.status, text: await response.text() };
}

function withCookie(options = {}) {
  return {
    ...options,
    headers: {
      ...sameOriginHeaders,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  };
}

function captureCookie(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return;
  cookie = raw.split(";")[0];
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
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
    });
  }
  return nodes;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForChrome(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await sleep(250);
  }
  throw new Error("Chrome did not expose a DevTools endpoint");
}

async function createChromePage(port) {
  const url = `http://127.0.0.1:${port}/json/new?about:blank`;
  let response = await fetch(url, { method: "PUT" }).catch(() => null);
  if (!response?.ok) response = await fetch(url).catch(() => null);
  if (response?.ok) {
    const target = await response.json();
    if (target.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
  }
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((item) => item.json());
  const page = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  if (!page) throw new Error("Chrome did not provide a page websocket URL");
  return page.webSocketDebuggerUrl;
}

class CdpConnection {
  constructor(wsUrl) {
    this.url = new URL(wsUrl);
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = [];
    this.errors = [];
    this.networkFailureEvents = [];
    this.assetResponseEvents = [];
    this.frameBuffer = Buffer.alloc(0);
    this.handshakeBuffer = Buffer.alloc(0);
    this.handshakeDone = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.url.hostname,
        port: Number(this.url.port),
      });
      this.socket = socket;
      const key = randomBytes(16).toString("base64");
      socket.once("connect", () => {
        socket.write(
          `GET ${this.url.pathname}${this.url.search} HTTP/1.1\r\n` +
          `Host: ${this.url.host}\r\n` +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Key: ${key}\r\n` +
          "Sec-WebSocket-Version: 13\r\n\r\n",
        );
      });
      socket.on("data", (chunk) => this.onData(chunk, resolve, reject));
      socket.on("error", reject);
      socket.on("close", () => {
        for (const [, pending] of this.pending) pending.reject(new Error("CDP websocket closed"));
        this.pending.clear();
      });
    });
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    this.writeFrame(payload);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  waitForEvent(method, predicate = () => true, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventWaiters = this.eventWaiters.filter((waiter) => waiter.resolve !== resolve);
        reject(new Error(`CDP event timed out: ${method}`));
      }, timeoutMs);
      this.eventWaiters.push({
        method,
        predicate,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
      });
    });
  }

  runtimeErrors() {
    return [...this.errors];
  }

  networkFailures() {
    return [...this.networkFailureEvents];
  }

  assetResponses() {
    return [...this.assetResponseEvents];
  }

  close() {
    this.socket?.end();
  }

  onData(chunk, resolveConnect, rejectConnect) {
    if (!this.handshakeDone) {
      this.handshakeBuffer = Buffer.concat([this.handshakeBuffer, chunk]);
      const headerEnd = this.handshakeBuffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.handshakeBuffer.slice(0, headerEnd).toString("utf8");
      if (!/^HTTP\/1\.1 101\b/.test(header)) {
        rejectConnect(new Error(`WebSocket handshake failed: ${header.split("\n")[0]}`));
        return;
      }
      this.handshakeDone = true;
      const rest = this.handshakeBuffer.slice(headerEnd + 4);
      this.handshakeBuffer = Buffer.alloc(0);
      resolveConnect();
      if (rest.length === 0) return;
      this.frameBuffer = Buffer.concat([this.frameBuffer, rest]);
    } else {
      this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);
    }
    this.parseFrames();
  }

  parseFrames() {
    while (this.frameBuffer.length >= 2) {
      const first = this.frameBuffer[0];
      const second = this.frameBuffer[1];
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let offset = 2;
      let length = second & 0x7f;
      if (length === 126) {
        if (this.frameBuffer.length < offset + 2) return;
        length = this.frameBuffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.frameBuffer.length < offset + 8) return;
        const high = this.frameBuffer.readUInt32BE(offset);
        const low = this.frameBuffer.readUInt32BE(offset + 4);
        length = high * 2 ** 32 + low;
        offset += 8;
      }
      let mask = null;
      if (masked) {
        if (this.frameBuffer.length < offset + 4) return;
        mask = this.frameBuffer.slice(offset, offset + 4);
        offset += 4;
      }
      if (this.frameBuffer.length < offset + length) return;
      let payload = this.frameBuffer.slice(offset, offset + length);
      this.frameBuffer = this.frameBuffer.slice(offset + length);
      if (mask) {
        payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
      }
      if (opcode === 1) this.handleMessage(payload.toString("utf8"));
      if (opcode === 8) this.close();
      if (opcode === 9) this.writeFrame(payload, 10);
    }
  }

  handleMessage(text) {
    const message = JSON.parse(text);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else pending.resolve(message.result || {});
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      this.errors.push(message.params?.exceptionDetails?.text || "Runtime exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
      this.errors.push(renderConsoleError(message.params));
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      const entry = message.params.entry;
      const text = entry.text || "Log error";
      const url = entry.url ? ` (${entry.url})` : "";
      if (!isIgnorableBrowserError(text, entry.url)) this.errors.push(`${text}${url}`);
    }
    if (message.method === "Network.loadingFailed") {
      const params = message.params || {};
      const failedUrl = String(params?.url || params?.documentURL || "");
      if (/\/assets\//.test(failedUrl) || /\.js(?:\?|$)/i.test(failedUrl)) {
        this.networkFailureEvents.push({
          url: failedUrl,
          errorText: String(params?.errorText || ""),
          canceled: Boolean(params?.canceled),
          blockedReason: params?.blockedReason || "",
          type: params?.type || "",
        });
      }
    }
    if (message.method === "Network.responseReceived") {
      const params = message.params || {};
      const response = params.response || {};
      const responseUrl = String(response.url || "");
      if (/\/assets\//.test(responseUrl) || /\.js(?:\?|$)/i.test(responseUrl)) {
        this.assetResponseEvents.push({
          url: responseUrl,
          status: Number(response.status || 0),
          mimeType: String(response.mimeType || ""),
          fromDiskCache: Boolean(response.fromDiskCache),
          fromServiceWorker: Boolean(response.fromServiceWorker),
          fromPrefetchCache: Boolean(response.fromPrefetchCache),
        });
      }
    }
    for (const waiter of [...this.eventWaiters]) {
      if (waiter.method !== message.method) continue;
      if (!waiter.predicate(message.params || {})) continue;
      this.eventWaiters = this.eventWaiters.filter((item) => item !== waiter);
      waiter.resolve(message.params || {});
    }
  }

  writeFrame(value, opcode = 1) {
    const payload = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
    const mask = randomBytes(4);
    let header;
    if (payload.length < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | payload.length;
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(payload.length, 6);
    }
    header[0] = 0x80 | opcode;
    const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    this.socket.write(Buffer.concat([header, mask, masked]));
  }
}

function renderConsoleError(params) {
  const args = Array.isArray(params?.args) ? params.args : [];
  const text = args.map((arg) => String(arg.value ?? arg.description ?? arg.type ?? "")).filter(Boolean).join(" ");
  return text || "Console error";
}

function isIgnorableBrowserError(text, url) {
  const value = String(text || "");
  const sourceUrl = String(url || "");
  return value.includes("status of 404") && /\/favicon\.ico(?:\?|$)/.test(sourceUrl);
}

function findChromePath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

await main();
