import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = process.env.VITE_APP_BASE_PATH || env.VITE_APP_BASE_PATH || "/cfdnadb/";

  return {
    base: basePath,
    plugins: [react()],
    resolve: {
      alias: {
        echarts: fileURLToPath(new URL("./node_modules/echarts", import.meta.url)),
        zrender: fileURLToPath(new URL("./node_modules/zrender", import.meta.url))
      }
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true
        }
      }
    }
  };
});
