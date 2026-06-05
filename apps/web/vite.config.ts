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
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __APP_NAME__: JSON.stringify("xinghuan-canvas"),
  },
});
