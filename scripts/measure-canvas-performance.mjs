import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const baseUrl = (process.env.XINGHUAN_VERIFY_BASE_URL || "http://127.0.0.1:18200").replace(/\/+$/, "");
const email = process.env.XINGHUAN_VERIFY_EMAIL || "admin@xinghuan.local";
const password = process.env.XINGHUAN_VERIFY_PASSWORD || "admin123456";
const chromePath = process.env.CHROME_PATH || findChromePath();
const outputPath = process.env.CANVAS_PERF_OUTPUT || join(process.cwd(), "output", "playwright", `canvas-performance-${Date.now()}.json`);
const scenarios = [0, 50, 100, 200];

if (!chromePath) throw new Error("Chrome executable was not found; set CHROME_PATH");

let cookie = "";
const createdCanvasIds = [];
let chrome;
let cdp;

async function run() {
try {
  await login();
  const port = await freePort();
  chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`, "--remote-allow-origins=*", `--user-data-dir=${await mkdtemp("xinghuan-canvas-perf-")}`,
    "--headless=new", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "about:blank",
  ], { stdio: "ignore" });
  await waitForChrome(port);
  cdp = new CdpConnection(await createChromePage(port));
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: instrumentSource() });
  await cdp.send("Network.setCookie", { name: cookie.split("=")[0], value: cookie.split("=").slice(1).join("="), url: baseUrl, path: "/", httpOnly: true, sameSite: "Lax" });

  const measurements = [];
  for (const count of scenarios) {
    const canvas = await createFixture(count);
    createdCanvasIds.push(canvas.id);
    const loaded = cdp.waitForEvent("Page.loadEventFired", () => true, 60000);
    await cdp.send("Page.navigate", { url: baseUrl });
    await loaded;
    const result = await evaluate(`(async () => {
      const expected = ${count};
      const startedAt = performance.now();
      let rendered = 0;
      while (performance.now() - startedAt < 45000) {
        rendered = document.querySelectorAll('.react-flow__node').length;
        if (rendered >= expected) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return {
        scenario: expected,
        renderedNodeCount: rendered,
        navigationDurationMs: navigation ? navigation.duration : null,
        domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd : null,
        loadEventMs: navigation ? navigation.loadEventEnd : null,
        resourceCount: resources.length,
        resourceTransferBytes: resources.reduce((total, entry) => total + (Number(entry.transferSize) || 0), 0),
        longTaskCount: window.__canvasPerf?.longTaskCount || 0,
        longTaskDurationMs: window.__canvasPerf?.longTaskDurationMs || 0,
        layoutShiftCount: window.__canvasPerf?.layoutShiftCount || 0,
        fetchCount: window.__canvasPerf?.fetchCount || 0,
        requestPathCounts: window.__canvasPerf?.requestPathCounts || {},
        rafSamples: window.__canvasPerf?.rafSamples || 0,
        runtimeErrors: window.__canvasPerf?.runtimeErrors || [],
      };
    })()`);
    measurements.push(result);
  }
  const payload = { generatedAt: new Date().toISOString(), baseUrl, version: "0.8.3", scenarios: measurements };
  await mkdir(join(process.cwd(), "output", "playwright"), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ ok: true, outputPath, scenarios: measurements }, null, 2));
} finally {
  for (const id of createdCanvasIds) await deleteFixture(id).catch(() => undefined);
  cdp?.close();
  if (chrome && !chrome.killed) chrome.kill();
}

}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, referer: `${baseUrl}/` }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`login failed: HTTP ${response.status}`);
  cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) throw new Error("login did not set a session cookie");
}

async function createFixture(count) {
  const headers = { "content-type": "application/json", origin: baseUrl, referer: `${baseUrl}/`, cookie };
  const created = await fetch(`${baseUrl}/api/canvas`, { method: "POST", headers, body: JSON.stringify({ name: `r4 perf fixture ${count}` }) });
  const createdJson = await created.json();
  const id = createdJson.data?.id;
  if (!id) throw new Error(`fixture create failed for ${count}`);
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `r4-perf-${count}-${index + 1}`,
    type: index % 4 === 0 ? "text" : index % 4 === 1 ? "image" : index % 4 === 2 ? "video" : "output",
    position: { x: (index % 10) * 260, y: Math.floor(index / 10) * 180 },
    data: { fixture: true, label: `Perf ${index + 1}`, index, prompt: "", text: "", outputText: "", status: "idle", model: "gpt-image-2", ratio: "16:9", duration: 5 },
  }))
  const updated = await fetch(`${baseUrl}/api/canvas/${encodeURIComponent(id)}`, { method: "PUT", headers, body: JSON.stringify({ nodes, edges: [], workflows: [], viewport: { x: 60, y: 40, zoom: 0.55 }, nextNodeSerialId: count + 1 }) });
  if (!updated.ok) throw new Error(`fixture update failed for ${count}: HTTP ${updated.status}`);
  return { id };
}

async function deleteFixture(id) {
  await fetch(`${baseUrl}/api/canvas/${encodeURIComponent(id)}`, { method: "DELETE", headers: { origin: baseUrl, referer: `${baseUrl}/`, cookie } });
}

function instrumentSource() {
  return `(() => {
    window.__canvasPerf = { longTaskCount: 0, longTaskDurationMs: 0, layoutShiftCount: 0, fetchCount: 0, requestPathCounts: {}, rafSamples: 0, runtimeErrors: [] };
    const originalFetch = window.fetch;
    window.fetch = (...args) => { const raw = args[0]; const path = typeof raw === 'string' ? raw : raw?.url || ''; const key = String(path).replace(location.origin, '') .split('?')[0]; window.__canvasPerf.fetchCount += 1; window.__canvasPerf.requestPathCounts[key] = (window.__canvasPerf.requestPathCounts[key] || 0) + 1; return originalFetch(...args); };
    window.addEventListener('error', (event) => window.__canvasPerf.runtimeErrors.push(String(event.message || 'runtime error')));
    if (window.PerformanceObserver) {
      try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => { window.__canvasPerf.longTaskCount += 1; window.__canvasPerf.longTaskDurationMs += entry.duration; })).observe({ type: 'longtask', buffered: true }); } catch {}
      try { new PerformanceObserver((list) => list.getEntries().forEach(() => { window.__canvasPerf.layoutShiftCount += 1; })).observe({ type: 'layout-shift', buffered: true }); } catch {}
    }
    const sample = () => { window.__canvasPerf.rafSamples += 1; if (window.__canvasPerf.rafSamples < 180) requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  })()`;
}

async function evaluate(expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, 60000);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "browser evaluation failed");
  return response.result?.value || {};
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

async function mkdtemp(prefix) {
  const path = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await (await import("node:fs/promises")).mkdir(path, { recursive: true });
  return path;
}

async function waitForChrome(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chrome did not expose a DevTools endpoint");
}

async function createChromePage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).catch(() => null);
  if (response?.ok) { const target = await response.json(); if (target.webSocketDebuggerUrl) return target.webSocketDebuggerUrl; }
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((item) => item.json());
  const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  if (!page) throw new Error("Chrome did not provide a page websocket URL");
  return page.webSocketDebuggerUrl;
}

class CdpConnection {
  constructor(wsUrl) { this.url = new URL(wsUrl); this.socket = null; this.nextId = 1; this.pending = new Map(); this.frameBuffer = Buffer.alloc(0); this.handshakeBuffer = Buffer.alloc(0); this.handshakeDone = false; }
  connect() { return new Promise((resolve, reject) => { const socket = net.createConnection({ host: this.url.hostname, port: Number(this.url.port) }); this.socket = socket; const key = randomBytes(16).toString("base64"); socket.once("connect", () => socket.write(`GET ${this.url.pathname}${this.url.search} HTTP/1.1\r\nHost: ${this.url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`)); socket.on("data", (chunk) => this.onData(chunk, resolve, reject)); socket.on("error", reject); }); }
  send(method, params = {}, timeoutMs = 30000) { const id = this.nextId++; this.writeFrame(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP request timed out: ${method}`)); }, timeoutMs); this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); }); }
  waitForEvent(method, predicate = () => true, timeoutMs = 30000) { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`CDP event timed out: ${method}`)), timeoutMs); this.eventWaiter = { method, predicate, resolve: (value) => { clearTimeout(timer); resolve(value); } }; }); }
  close() { this.socket?.end(); }
  onData(chunk, resolveConnect, rejectConnect) { if (!this.handshakeDone) { this.handshakeBuffer = Buffer.concat([this.handshakeBuffer, chunk]); const end = this.handshakeBuffer.indexOf("\r\n\r\n"); if (end < 0) return; const header = this.handshakeBuffer.slice(0, end).toString("utf8"); if (!/^HTTP\/1\.1 101\b/.test(header)) { rejectConnect(new Error("CDP websocket handshake failed")); return; } this.handshakeDone = true; const rest = this.handshakeBuffer.slice(end + 4); this.handshakeBuffer = Buffer.alloc(0); resolveConnect(); if (rest.length) this.frameBuffer = Buffer.concat([this.frameBuffer, rest]); } else this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]); this.parseFrames(); }
  parseFrames() { while (this.frameBuffer.length >= 2) { const first = this.frameBuffer[0]; const second = this.frameBuffer[1]; const opcode = first & 0x0f; const masked = Boolean(second & 0x80); let offset = 2; let length = second & 0x7f; if (length === 126) { if (this.frameBuffer.length < offset + 2) return; length = this.frameBuffer.readUInt16BE(offset); offset += 2; } else if (length === 127) { if (this.frameBuffer.length < offset + 8) return; length = this.frameBuffer.readUInt32BE(offset + 4); offset += 8; } const mask = masked ? this.frameBuffer.slice(offset, offset + 4) : null; if (masked) offset += 4; if (this.frameBuffer.length < offset + length) return; let payload = this.frameBuffer.slice(offset, offset + length); this.frameBuffer = this.frameBuffer.slice(offset + length); if (mask) payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4])); if (opcode === 1) this.handleMessage(payload.toString("utf8")); if (opcode === 8) this.close(); if (opcode === 9) this.writeFrame(payload, 10); } }
  handleMessage(text) { const message = JSON.parse(text); if (message.id) { const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); if (message.error) pending.reject(new Error(message.error.message || "CDP error")); else pending.resolve(message.result || {}); return; } if (this.eventWaiter?.method === message.method && this.eventWaiter.predicate(message.params || {})) { const waiter = this.eventWaiter; this.eventWaiter = null; waiter.resolve(message.params || {}); } }
  writeFrame(value, opcode = 1) { const payload = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8"); const mask = randomBytes(4); let header; if (payload.length < 126) { header = Buffer.alloc(2); header[1] = 0x80 | payload.length; } else if (payload.length < 65536) { header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); } else { header = Buffer.alloc(10); header[1] = 0x80 | 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(payload.length, 6); } header[0] = 0x80 | opcode; const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4])); this.socket.write(Buffer.concat([header, mask, masked])); }
}

function findChromePath() {
  const candidates = process.platform === "win32" ? [process.env.CHROME_PATH, `${process.env.ProgramFiles || "C:/Program Files"}/Google/Chrome/Application/chrome.exe`, `${process.env.LOCALAPPDATA || ""}/Google/Chrome/Application/chrome.exe`] : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((value) => value && requireExists(value));
}

function requireExists(path) { return existsSync(path); }

await run();
