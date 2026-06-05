import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
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
        manualChunks: {
          // [mimo-perf] React 生态单独分包，便于长期缓存
          "vendor-react": ["react", "react-dom"],
          // [mimo-perf] 画布引擎单独分包
          "vendor-flow": ["@xyflow/react"],
          // [mimo-perf] MediaPipe 单独分包（体积较大）
          "vendor-mediapipe": ["@mediapipe/tasks-vision"],
          // [mimo-perf] 图标库单独分包
          "vendor-icons": ["lucide-react"],
        },
      },
    },
    // [mimo-perf] 提高 chunk 警告阈值到 600KB
    chunkSizeWarningLimit: 600,
  },
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __APP_NAME__: JSON.stringify("xinghuan-canvas"),
  },
});
