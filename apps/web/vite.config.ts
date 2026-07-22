import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const webBuildMarker = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const rootPackageJson = JSON.parse(readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"));
const appVersion = String(rootPackageJson.version || "").trim() || "0.0.0";

function manualVendorChunk(id: string) {
  const normalizedId = id.replaceAll("\\", "/");
  if (normalizedId.includes("/node_modules/@xyflow/react/")) return "vendor-flow";
  if (normalizedId.includes("/node_modules/@mediapipe/tasks-vision/")) return "vendor-mediapipe";
  if (normalizedId.includes("/node_modules/lucide-react/")) return "vendor-icons";
  return undefined;
}

function buildMetaPlugin() {
  return {
    name: "xinghuan-web-build-meta",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      mkdirSync(distDir, { recursive: true });
      writeFileSync(
        path.join(distDir, "build-meta.json"),
        JSON.stringify({ app: "web", buildMarker: webBuildMarker }, null, 2),
        "utf8",
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), buildMetaPlugin()],
  assetsInclude: ["**/*.mid"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 18310,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:18300",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest, request) => {
            proxyRequest.setHeader("x-forwarded-host", request.headers.host || "127.0.0.1:18310");
            proxyRequest.setHeader("x-forwarded-proto", "http");
          });
        },
      },
      "/files": {
        target: "http://127.0.0.1:18300",
        changeOrigin: true,
      },
      "/output": {
        target: "http://127.0.0.1:18300",
        changeOrigin: true,
      },
      "/input": {
        target: "http://127.0.0.1:18300",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown 使用函数式 manualChunks；保持既有三类 vendor 分包语义。
        manualChunks: manualVendorChunk,
      },
    },
    // [mimo-perf] 提高 chunk 警告阈值到 600KB
    chunkSizeWarningLimit: 600,
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_NAME__: JSON.stringify("xinghuan-canvas"),
    __WEB_BUILD_MARKER__: JSON.stringify(webBuildMarker),
  },
});
