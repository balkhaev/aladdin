import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitroV2Plugin({
      preset: "bun",
    }),
    react({
      // Включаем automatic JSX runtime для React 19
      jsxRuntime: "automatic",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  // Оптимизация dev сервера
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      // Proxy для всех API через Gateway
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      // WebSocket proxy
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  preview: {
    port: 3001,
    host: "0.0.0.0",
    allowedHosts: ["aladdin.balkhaev.com"],
  },
  // Предварительная оптимизация зависимостей
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
    ],
  },
});
