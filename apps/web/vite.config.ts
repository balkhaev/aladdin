import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({}),
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
    // Настройки для оптимизации production сборки
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Разбиваем код на chunks для лучшего кэширования
        manualChunks: {
          // React и основные зависимости
          "vendor-react": ["react", "react-dom"],
          // Routing
          "vendor-router": ["@tanstack/react-router"],
          // Query и state management
          "vendor-query": ["@tanstack/react-query"],
          // UI компоненты Radix
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-accordion",
          ],
          // Charts и визуализация
          "vendor-charts": ["recharts", "lightweight-charts"],
          // Utilities
          "vendor-utils": ["date-fns", "clsx", "tailwind-merge"],
        },
        // Динамическое именование chunks для лучшего кэширования
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split("/").at(-1)
            : "chunk";
          return `assets/${facadeModuleId}-[hash].js`;
        },
      },
    },
    // Оптимизация размера чанков
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
